import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile, copyFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { gunzipSync } from "node:zlib";

const ROOT = resolve(process.env.ISLAND_WORKER_DATA || "./island-worker-data");
const NATIVE_ENGINE = resolve(process.env.ISLAND_NATIVE_ENGINE || "./.islandforge/bin/island-forge-native-engine.exe");
const TOKEN = process.env.ISLAND_EXPORT_BRIDGE_TOKEN || "islandforge-local-development-only";
const HOST = process.env.ISLAND_WORKER_HOST || "127.0.0.1";
const PORT = Number(process.env.ISLAND_EXPORT_BRIDGE_PORT || 8787);
const MAX_BODY = Number(process.env.ISLAND_WORKER_MAX_BODY || 256 * 1024 * 1024);
const MAX_QUEUE = Number(process.env.ISLAND_WORKER_MAX_QUEUE || 8);
const RETENTION_MS = 24 * 60 * 60 * 1000;
const jobs = new Map();
const queue = [];
let active = false;

if (!["127.0.0.1", "::1", "localhost"].includes(HOST) && !process.env.ISLAND_EXPORT_BRIDGE_TOKEN) {
  console.error("A custom ISLAND_EXPORT_BRIDGE_TOKEN is required when the worker is not bound to loopback.");
  process.exit(1);
}

await mkdir(ROOT, { recursive: true });

function json(res, status, body) {
  const bytes = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": bytes.length, "cache-control": "no-store" });
  res.end(bytes);
}

function authorized(req) {
  if (!TOKEN) return false;
  const header = req.headers.authorization || "";
  return header === "Bearer " + TOKEN;
}

async function readBody(req) {
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_BODY) throw new Error("payload_too_large");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const safeName = (value) => /^[a-zA-Z0-9_-]{1,48}$/.test(value || "");

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Corps JSON invalide.");
  if (![8, 9].includes(payload.gen)) throw new Error("La génération doit être 8 ou 9.");
  const params = payload.params || {};
  if (!safeName(params.name)) throw new Error("Nom de ressource invalide (lettres, chiffres, _ et - uniquement).");
  const terrain = payload.terrain || {};
  const edits = payload.edits || {};
  const n = Number(edits.n || terrain.resolution);
  if (!Number.isInteger(n) || n < 33 || n > 2049) throw new Error("Résolution terrain hors limites (33–2049).");
  if (edits.format !== "float32-le") throw new Error("Format de terrain non pris en charge.");
  const sampleCount = n * n;
  const counts = edits.counts || {
    heights: edits.heightsCount,
    blendWeights: edits.blendCount,
    vegetationMask: edits.vegetationCount,
    land: sampleCount,
    props: edits.propsCount || 0,
    grass: edits.grassCount || 0,
  };
  const expected = {
    heights: sampleCount,
    blendWeights: sampleCount * 4,
    vegetationMask: sampleCount,
    land: sampleCount,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (Number(counts[key]) !== value) throw new Error("Nombre de valeurs invalide pour " + key + ".");
  }
  for (const key of ["props", "grass"]) {
    const value = Number(counts[key] || 0);
    if (!Number.isSafeInteger(value) || value < 0 || value > 2_000_000) throw new Error("Nombre de placements invalide pour " + key + ".");
    const stride = key === "props" ? 6 : 4;
    if (value % stride !== 0) throw new Error("Taille de buffer invalide pour " + key + ".");
  }
  const totalFloats = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  if (totalFloats > 40_000_000) throw new Error("Carte trop dense pour le worker Windows.");
  if (typeof edits.data !== "string" || edits.data.length > MAX_BODY * 1.4) throw new Error("Buffer binaire manquant ou trop volumineux.");
  return { n, counts, totalBytes: totalFloats * 4, params, terrain };
}

async function writeJobPayload(id, payload) {
  const dir = join(ROOT, id);
  await mkdir(dir, { recursive: true });
  const validated = validatePayload(payload);
  let raw = Buffer.from(payload.edits.data, "base64");
  if (payload.edits.compression === "gzip") raw = gunzipSync(raw, { maxOutputLength: validated.totalBytes });
  else if (payload.edits.compression !== "none") throw new Error("Compression non prise en charge.");
  if (raw.length !== validated.totalBytes) throw new Error("Longueur du buffer terrain incorrecte.");

  const binaryPath = join(dir, "terrain.f32");
  await writeFile(binaryPath, raw);
  const meta = {
    id,
    createdAt: new Date().toISOString(),
    generation: payload.gen,
    params: payload.params,
    terrain: payload.terrain,
    materials: payload.materials || [],
    options: payload.options || {},
    counts: validated.counts,
    placedAssets: Array.isArray(payload.placedAssets) ? payload.placedAssets.slice(0, 10000) : [],
    binaryFile: "terrain.f32",
  };
  await writeFile(join(dir, "job.json"), JSON.stringify(meta, null, 2));
  return { dir, meta };
}

async function updateJob(job, patch) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  await writeFile(join(job.dir, "status.json"), JSON.stringify({
    id: job.id, state: job.state, stage: job.stage, done: job.done, total: job.total,
    nativeReady: job.nativeReady, warning: job.warning, error: job.error,
    createdAt: job.createdAt, updatedAt: job.updatedAt,
  }, null, 2));
}

async function collectFiles(directory) {
  const files = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(path);
    }
  }
  await walk(directory);
  return files;
}

function runProcess(executable, args, cwd, onProgress) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, { cwd, windowsHide: true, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const collect = (buffer, chunk) => {
      const next = buffer + chunk.toString("utf8");
      const lines = next.split(/\r?\n/);
      return { rest: lines.pop() || "", lines };
    };
    let stdoutRest = "", stderrRest = "";
    child.stdout.on("data", (chunk) => {
      const parsed = collect(stdoutRest, chunk);
      stdoutRest = parsed.rest;
      for (const line of parsed.lines) {
        stdout += line + "\n";
        if (line.startsWith("ISLAND_PROGRESS:")) {
          try { onProgress(JSON.parse(line.slice("ISLAND_PROGRESS:".length))); } catch { /* ignore malformed progress */ }
        }
        if (stdout.length > 2_000_000) stdout = stdout.slice(-1_000_000);
      }
    });
    child.stderr.on("data", (chunk) => {
      const parsed = collect(stderrRest, chunk);
      stderrRest = parsed.rest;
      for (const line of parsed.lines) {
        stderr += line + "\n";
        if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error("Blender a quitté avec le code " + code + ".\n" + stderr.slice(-8000)));
    });
  });
}

async function processJob(job) {
  if (!existsSync(NATIVE_ENGINE)) {
    throw new Error("Le moteur natif GTA Island Forge est introuvable. Relance npm run dev avec une connexion Internet pour télécharger le moteur intégré.");
  }

  const artifacts = join(job.dir, "artifacts");
  await mkdir(artifacts, { recursive: true });
  await updateJob(job, { state: "running", stage: "Génération des ressources RAGE", done: 1, total: 7, error: null });
  const result = await runProcess(NATIVE_ENGINE, [
    "--job", join(job.dir, "job.json"),
    "--output", artifacts,
  ], job.dir, (progress) => {
    updateJob(job, {
      stage: String(progress.stage || "Export natif RAGE"),
      done: Math.max(1, Math.min(6, Number(progress.done) || 1)),
      total: 7,
      warning: progress.warning || job.warning || null,
    }).catch(() => {});
  });

  const files = await collectFiles(artifacts);
  const nativeExts = new Set([".ydr", ".ybn", ".ytyp", ".ytd", ".ymap"]);
  const nativeFiles = files.filter((path) => nativeExts.has(extname(path).toLowerCase()));
  const nativeMapFiles = files.filter((path) => extname(path).toLowerCase() === ".ymap");
  const count = (ext) => files.filter((path) => extname(path).toLowerCase() === ext).length;
  const requiredTypes = [".ydr", ".ybn", ".ytyp", ".ytd", ".ymap"];
  const missingTypes = requiredTypes.filter((ext) => count(ext) < 1);
  if (missingTypes.length) {
    const log = result.stderr.slice(-4000) || result.stdout.slice(-4000);
    throw new Error("Le moteur RAGE n'a pas produit tous les fichiers GTA attendus. Manquants : " + missingTypes.join(", ") + ". " + log);
  }
  for (const path of nativeMapFiles) {
    const header = (await readFile(path)).subarray(0, 4).toString("ascii");
    if (header !== "RSC7") {
      throw new Error("Le fichier .ymap généré ne possède pas l'en-tête RSC7 : " + relative(artifacts, path));
    }
  }

  await updateJob(job, { stage: "Assemblage de la ressource FiveM", done: 6, total: 7 });
  const packageDir = join(job.dir, "package");
  const streamDir = join(packageDir, "stream");
  const reportDir = join(packageDir, "report");
  const configDir = join(packageDir, "config");
  for (const folder of [streamDir, reportDir, configDir]) await mkdir(folder, { recursive: true });

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const relativeFile = relative(artifacts, file);
    if (nativeExts.has(ext)) {
      const destination = join(streamDir, relativeFile.replace(/[\\/]/g, "_"));
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, await readFile(file));
    }
  }

  const nativeReady = nativeMapFiles.length > 0 && requiredTypes.every((ext) => count(ext) > 0);
  const manifest = [
    "fx_version 'cerulean'",
    "game 'gta5'",
    "author 'Island Forge'",
    "description 'Island Forge generated terrain resource'",
    "version '1.0.0'",
    "this_is_a_map 'yes'",
    "",
    "files { 'stream/*.ytyp' }",
    "data_file 'DLC_ITYP_REQUEST' 'stream/*.ytyp'",
  ].join("\n") + "\n";
  await writeFile(join(packageDir, "fxmanifest.lua"), manifest);
  const generation = "gen" + job.meta.generation;
  await writeFile(join(packageDir, "config", "native-export.json"), JSON.stringify({
    resource: job.meta.params.name,
    generation,
    nativeAssets: nativeFiles.map((path) => relative(artifacts, path)),
    ymapBinary: nativeMapFiles.map((path) => relative(artifacts, path)),
    exportBackend: "Island Forge Native Engine + ragekit",
    counts: {
      ydr: count(".ydr"), ybn: count(".ybn"), ytyp: count(".ytyp"), ytd: count(".ytd"),
      ymap: count(".ymap"),
    },
    nativeReady,
    manualCodeWalkerFinalizeRequired: false,
    reason: "Les ressources RAGE sont écrites et relues par le moteur natif. CodeWalker reste facultatif pour inspection.",
  }, null, 2));

  await writeFile(join(packageDir, "README_INSTALL.txt"), [
    "ISLAND FORGE — NATIVE FIVEM MAP",
    "",
    "Island Forge Native Engine generated native YDR, YBN, YMAP, YTYP and YTD assets for " + generation + ".",
    "The YMAP is a native RSC7 resource and is included in stream/.",
    "The assets were written and validated by ragekit. No Blender or CodeWalker conversion is required.",
    "",
    "INSTALLATION:",
    "1. Copy this folder into your FiveM resources directory.",
    "2. Add the resource name to server.cfg with ensure " + job.meta.params.name + ".",
    "3. Check that referenced GTA tree/rock archetypes exist on the target server build.",
    "4. Inspect the map in CodeWalker if desired, then test it on a clean FiveM server.",
    "",
    "The export report records native asset counts and known limitations.",
  ].join("\n") + "\n");

  await writeFile(join(reportDir, "export-report.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    generation,
    nativeReady,
    nativeExportBackend: "Island Forge Native Engine + ragekit",
    binaryAssets: {
      ydr: count(".ydr"), ybn: count(".ybn"), ytyp: count(".ytyp"), ytd: count(".ytd"),
      ymap: count(".ymap"),
    },
    note: "YMAP natif RSC7 relu par ragekit. Aucune conversion Blender n'est utilisée.",
  }, null, 2));

  const engineReport = join(artifacts, "native-engine-report.json");
  if (await stat(engineReport).then(() => true).catch(() => false)) {
    await copyFile(engineReport, join(reportDir, "native-engine-report.json"));
  }
  await writeFile(join(configDir, "placed-assets.json"), JSON.stringify(job.meta.placedAssets || [], null, 2));

  for (const name of ["materials.json", "vegetation-placements.json", "grass-placements.json", "water.json"]) {
    const source = join(artifacts, "config", name);
    if (await stat(source).then(() => true).catch(() => false)) {
      await copyFile(source, join(configDir, name));
    }
  }
  if (!(await stat(join(configDir, "materials.json")).then(() => true).catch(() => false))) {
    await writeFile(join(configDir, "materials.json"), JSON.stringify(job.meta.materials || [], null, 2));
  }
  await writeFile(join(configDir, "worker-job.json"), JSON.stringify({
    generation: job.meta.generation,
    params: job.meta.params,
    terrain: job.meta.terrain,
    options: job.meta.options,
    counts: job.meta.counts,
    placedAssets: job.meta.placedAssets || [],
  }, null, 2));

  const ps = [
    "$ErrorActionPreference = 'Stop'",
    "$source = '" + packageDir.replace(/'/g, "''") + "'",
    "$destination = '" + join(job.dir, "island-forge-" + generation + ".zip").replace(/'/g, "''") + "'",
    "Compress-Archive -Path (Join-Path $source '*') -DestinationPath $destination -Force",
  ].join("; ");
  await runProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], job.dir, () => {});
  const zipPath = join(job.dir, "island-forge-" + generation + ".zip");
  const zipInfo = await stat(zipPath);
  await updateJob(job, {
    state: "done", stage: "Export natif YDR/YBN/YMAP/YTYP/YTD terminé",
    done: 7, total: 7, nativeReady, warning: null,
    file: zipPath, fileSize: zipInfo.size,
  });
}

async function runQueue() {
  if (active) return;
  active = true;
  while (queue.length) {
    const id = queue.shift();
    const job = jobs.get(id);
    if (!job || job.state !== "queued") continue;
    try {
      await processJob(job);
    } catch (error) {
      await updateJob(job, { state: "error", stage: "Échec de l'export", error: error instanceof Error ? error.message : String(error) });
    }
  }
  active = false;
}

const server = createServer(async (req, res) => {
  if (!authorized(req)) return json(res, 401, { error: "Authentification du worker invalide." });
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      worker: "island-forge",
      engine: "ragekit",
      nativeEngineAvailable: existsSync(NATIVE_ENGINE),
      blenderRequired: false,
    });
  }
  if (req.method === "POST" && url.pathname === "/api/export/jobs") {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (error) {
      return json(res, error.message === "payload_too_large" ? 413 : 400, { error: error.message === "payload_too_large" ? "Payload trop volumineux." : "JSON invalide." });
    }
    if (queue.length + (active ? 1 : 0) >= MAX_QUEUE) return json(res, 429, { error: "File d'export saturée, réessaie plus tard." });
    const id = randomUUID().replace(/-/g, "");
    try {
      const { dir, meta } = await writeJobPayload(id, payload);
      const job = {
        id, dir, meta, state: "queued", stage: "En attente du worker Windows",
        done: 0, total: 7, nativeReady: false, warning: null, error: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      jobs.set(id, job);
      queue.push(id);
      await updateJob(job, {});
      runQueue();
      return json(res, 202, { id, state: "running", stage: job.stage });
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  const match = url.pathname.match(/^\/api\/export\/jobs\/([a-f0-9]{32})(\/file)?$/);
  if (req.method === "GET" && match) {
    const job = jobs.get(match[1]);
    if (!job) return json(res, 404, { error: "Job inconnu ou expiré." });
    if (match[2]) {
      if (job.state !== "done" || !job.file) return json(res, 409, { error: "Le ZIP n'est pas encore prêt." });
      res.writeHead(200, {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="' + job.meta.params.name + '_gen' + job.meta.generation + '.zip"',
        "content-length": job.fileSize,
        "cache-control": "no-store",
      });
      return createReadStream(job.file).pipe(res);
    }
    return json(res, 200, {
      id: job.id, state: job.state, stage: job.stage, done: job.done, total: job.total,
      nativeReady: job.nativeReady, warning: job.warning, error: job.error,
    });
  }

  return json(res, 404, { error: "Route introuvable." });
});

server.listen(PORT, HOST, () => {
  console.log("Island Forge local export worker listening on " + HOST + ":" + PORT);
  console.log("Native engine: " + (existsSync(NATIVE_ENGINE) ? NATIVE_ENGINE : "(not installed yet — source export remains available)"));
});
