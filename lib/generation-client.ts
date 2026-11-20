"use client";

import { generateIsland, type IslandSettings, type TerrainData } from "./terrain";

export function generateIslandAsync(settings: IslandSettings): Promise<TerrainData> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("../workers/terrain.worker.ts", import.meta.url), { type: "module" });
    } catch {
      window.setTimeout(() => {
        try { resolve(generateIsland(settings)); } catch (error) { reject(error); }
      }, 10);
      return;
    }

    const cleanup = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<{ ok: boolean; data?: TerrainData; error?: string }>) => {
      cleanup();
      if (event.data.ok && event.data.data) resolve(event.data.data);
      else reject(new Error(event.data.error || "Terrain generation failed"));
    };
    worker.onerror = (event) => {
      cleanup();
      try { resolve(generateIsland(settings)); } catch (error) { reject(error); }
    };
    worker.postMessage(settings);
  });
}
