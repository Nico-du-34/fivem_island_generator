import { generateIsland, type IslandSettings, type TerrainData } from "../lib/terrain";

self.onmessage = (event: MessageEvent<IslandSettings>) => {
  try {
    const result: TerrainData = generateIsland(event.data);
    const transferables = [
      result.positions.buffer,
      result.colors.buffer,
      result.blendWeights.buffer,
      result.indices.buffer,
      result.heights.buffer,
      result.land.buffer,
      result.vegetationMask.buffer,
      result.props.buffer,
      result.grass.buffer,
      result.faceTiles.buffer,
      result.faceMaterials.buffer,
    ] as Transferable[];
    (self as unknown as { postMessage(message: unknown, transfer?: Transferable[]): void }).postMessage({ ok: true, data: result }, transferables);
  } catch (error) {
    (self as unknown as { postMessage(message: unknown, transfer?: Transferable[]): void }).postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Terrain generation failed",
    });
  }
};

export {};
