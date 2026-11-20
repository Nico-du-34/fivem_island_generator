import { spawn } from "node:child_process";
import { connect } from "node:net";
import { existsSync } from "node:fs";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
  console.error("[Island Forge] Un worker distant nécessite un token personnalisé. Pour le lancement local, retire ISLAND_EXPORT_BRIDGE_URL.");
  process.exit(1);
}
if (!isLoopback && (!process.env.ISLAND_EXPORT_BRIDGE_TOKEN || bridgeToken === localToken)) {
  console.error("[Island Forge] Un worker réseau exige un token personnalisé ; le token local ne peut servir que sur loopback.");
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

async function installNativeEngine() {
  const configured = process.env.ISLAND_NATIVE_ENGINE;
  if (configured && existsSync(configured)) {
    env.ISLAND_NATIVE_ENGINE = configured;
    console.log("[Island Forge] Moteur natif trouvé :", configured);
    return true;
  }

  const executable = process.platform === "win32"
    ? "island-forge-native-engine.exe"
    : "island-forge-native-engine";
  const localPath = join(root, ".islandforge", "bin", executable);
  if (existsSync(localPath)) {
    env.ISLAND_NATIVE_ENGINE = localPath;
    console.log("[Island Forge] Moteur natif local :", localPath);
    return true;
  }

  if (process.platform !== "win32" || process.arch !== "x64") {
    console.warn("[Island Forge] Le moteur d'export GTA natif est fourni pour Windows x64. L'éditeur et l'export source restent disponibles sur cette plateforme.");
    return false;
  }

  const releaseUrl = "https://github.com/Nico-du-34/fivem_island_generator/releases/download/native-engine-v0.1.0/island-forge-native-engine-win-x64.exe";
  console.log("[Island Forge] Vérification du moteur d'export GTA intégré…");
  try {
    const response = await fetch(releaseUrl, { signal: AbortSignal.timeout(45_000) });
    if (!response.ok) {
      console.warn("[Island Forge] Le binaire natif n'est pas encore publié (HTTP " + response.status + "). L'export source reste disponible.");
      return false;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 256_000 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
      throw new Error("Le fichier téléchargé n'est pas un exécutable Windows valide.");
    }
    await mkdir(dirname(localPath), { recursive: true });
    const temporaryPath = localPath + ".download";
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, localPath);
    env.ISLAND_NATIVE_ENGINE = localPath;
    console.log("[Island Forge] Moteur natif installé automatiquement :", localPath);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[Island Forge] Téléchargement du moteur natif impossible : " + message);
    console.warn("[Island Forge] Tu peux toujours générer et exporter les fichiers source OBJ/GLB.");
    return false;
  }
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
  if (workerHost === "127.0.0.1" || workerHost === "::1" || workerHost === "localhost") {
    await installNativeEngine();
  }
  const port = Number(env.ISLAND_WORKER_PORT);
  if (!(await portIsOpen(port))) {
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
      console.log("[Island Forge] Worker local prêt sur", localBase);
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
  } else {
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
}
