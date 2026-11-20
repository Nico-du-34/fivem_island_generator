import { spawn, spawnSync } from "node:child_process";
import { connect } from "node:net";
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] || "dev";
const forwardedArgs = process.argv.slice(3);
const localBase = "http://127.0.0.1:8787";
const localToken = "islandforge-local-development-only";
const bridgeUrl = (process.env.ISLAND_EXPORT_BRIDGE_URL || localBase).replace(/\/+$/, "");
const bridgeToken = process.env.ISLAND_EXPORT_BRIDGE_TOKEN || localToken;
const workerHost = process.env.ISLAND_WORKER_HOST || "127.0.0.1";
const isLoopback = ["127.0.0.1", "::1", "localhost"].includes(workerHost);
const isLocalBridge = bridgeUrl === localBase;

if (!isLocalBridge && !process.env.ISLAND_EXPORT_BRIDGE_TOKEN) {
  console.error("[Island Forge] Un worker distant nécessite ISLAND_EXPORT_BRIDGE_TOKEN. Pour le lancement local, retire ISLAND_EXPORT_BRIDGE_URL.");
  process.exit(1);
}
if (!isLoopback && (!process.env.ISLAND_EXPORT_BRIDGE_TOKEN || bridgeToken === localToken)) {
  console.error("[Island Forge] Un worker réseau nécessite une adresse loopback interdite au défaut et un token personnalisé long.");
  process.exit(1);
}

process.chdir(root);
const env = {
  ...process.env,
  ISLAND_EXPORT_BRIDGE_URL: bridgeUrl,
  ISLAND_EXPORT_BRIDGE_TOKEN: bridgeToken,
  ISLAND_WORKER_HOST: workerHost,
  ISLAND_WORKER_PORT: process.env.ISLAND_WORKER_PORT || "8787",
  ISLAND_WORKER_DATA: process.env.ISLAND_WORKER_DATA || join(root, ".islandforge", "jobs"),
};

function executableOnPath(command) {
  try {
    const lookup = process.platform === "win32" ? "where.exe" : "which";
    const result = spawnSync(lookup, [command], { encoding: "utf8", windowsHide: true, timeout: 3000 });
    const candidate = result.stdout?.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    return candidate && existsSync(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function findBlender() {
  const candidates = [];
  if (env.BLENDER_PATH) candidates.push(env.BLENDER_PATH);
  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const local = process.env.LOCALAPPDATA || "";
    for (const base of [join(programFiles, "Blender Foundation"), join(local, "Programs", "Blender Foundation")]) {
      try {
        for (const entry of readdirSync(base, { withFileTypes: true })) {
          if (entry.isDirectory() && /^Blender\s+\d/i.test(entry.name)) {
            candidates.push(join(base, entry.name, "blender.exe"));
          }
        }
      } catch { /* Blender may be installed somewhere else. */ }
    }
  }
  candidates.push(executableOnPath(process.platform === "win32" ? "blender.exe" : "blender"));
  return candidates.find((candidate) => candidate && existsSync(candidate)) || null;
}

function findSollumz(blenderPath) {
  if (env.SOLLUMZ_ADDON_PATH && existsSync(env.SOLLUMZ_ADDON_PATH)) return env.SOLLUMZ_ADDON_PATH;
  if (process.platform !== "win32") return null;
  const appData = process.env.APPDATA;
  if (!appData) return null;
  const blenderRoot = join(appData, "Blender Foundation", "Blender");
  let versions = [];
  try {
    versions = readdirSync(blenderRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+\.\d+/.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return null;
  }
  const blenderVersion = blenderPath
    ? spawnSync(blenderPath, ["--version"], { encoding: "utf8", windowsHide: true, timeout: 5000 }).stdout?.match(/Blender\s+(\d+\.\d+)/)?.[1]
    : null;
  versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  if (blenderVersion) versions.sort((a, b) => Number(b.startsWith(blenderVersion)) - Number(a.startsWith(blenderVersion)));
  for (const version of versions) {
    const addons = join(blenderRoot, version, "scripts", "addons");
    try {
      const entries = readdirSync(addons, { withFileTypes: true });
      const addon = entries.find((entry) => entry.isDirectory() && entry.name.toLowerCase().includes("sollumz"));
      if (addon) return join(addons, addon.name);
    } catch { /* Try the next Blender profile. */ }
  }
  return null;
}

function portIsOpen(port) {
  return new Promise((resolvePromise) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.setTimeout(400);
    socket.once("connect", () => { socket.destroy(); resolvePromise(true); });
    socket.once("error", () => resolvePromise(false));
    socket.once("timeout", () => { socket.destroy(); resolvePromise(false); });
  });
}

function waitForPort(port, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise(async (resolvePromise) => {
    while (Date.now() - start < timeoutMs) {
      if (await portIsOpen(port)) return resolvePromise(true);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 120));
    }
    resolvePromise(false);
  });
}

const startLocalWorker = mode === "worker" || env.ISLAND_EXPORT_BRIDGE_URL === localBase;
let worker = null;
let web = null;
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (web && !web.killed) web.kill();
  if (worker && !worker.killed) worker.kill();
  process.exitCode = code;
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));

if (startLocalWorker) {
  const port = Number(env.ISLAND_WORKER_PORT);
  if (!(await portIsOpen(port))) {
    const blender = findBlender();
    if (blender) {
      env.BLENDER_PATH = blender;
      const addon = findSollumz(blender);
      if (addon) {
        env.SOLLUMZ_ADDON_PATH = addon;
        env.SOLLUMZ_ADDON_MODULE = env.SOLLUMZ_ADDON_MODULE || basename(addon);
      }
      console.log("[Island Forge] Blender détecté :", blender);
      if (addon) console.log("[Island Forge] Sollumz détecté :", addon);
      else console.log("[Island Forge] Sollumz non détecté automatiquement ; vérifie son installation dans Blender.");
    } else {
      console.warn("[Island Forge] Blender non détecté. L'éditeur et l'export source fonctionneront ; l'export GTA natif demandera Blender + Sollumz.");
    }

    const workerEntry = join(root, "native-worker", "server.mjs");
    worker = spawn(process.execPath, [workerEntry], {
      cwd: root,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    worker.once("error", (error) => console.error("[Island Forge] Impossible de démarrer le worker :", error.message));
    worker.once("exit", (code) => {
      if (!stopping && mode === "worker") stop(code ?? 1);
      else if (!stopping) console.warn("[Island Forge] Le worker local s'est arrêté.");
    });
    if (!(await waitForPort(port))) {
      console.warn("[Island Forge] Le worker ne répond pas encore. L'éditeur reste disponible.");
    } else {
      console.log("[Island Forge] Worker d'export local prêt sur", localBase);
    }
  } else {
    console.log("[Island Forge] Worker local déjà démarré sur", localBase);
  }
}

if (mode === "worker") {
  if (!worker && await portIsOpen(Number(env.ISLAND_WORKER_PORT))) {
    console.log("[Island Forge] Le worker répond déjà sur", localBase);
  } else if (worker) {
    await new Promise((resolvePromise) => worker.once("exit", resolvePromise));
  }
} else {
const nextCli = join(root, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextCli)) {
  console.error("[Island Forge] Next.js est introuvable. Lance npm install depuis la racine du projet.");
  stop(1);
}
const webMode = mode === "start" ? "start" : "dev";
web = spawn(process.execPath, [nextCli, webMode, ...forwardedArgs], {
  cwd: root,
  env,
  stdio: "inherit",
  windowsHide: true,
});
web.once("error", (error) => {
  console.error("[Island Forge] Impossible de démarrer Next.js :", error.message);
  stop(1);
});
web.once("exit", (code, signal) => stop(code ?? (signal ? 1 : 0)));
}
