import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES = {
  objects: {
    url: "https://raw.githubusercontent.com/DurtyFree/gta-v-data-dumps/master/ObjectList.ini",
    kind: "lines",
  },
  zones: {
    url: "https://raw.githubusercontent.com/DurtyFree/gta-v-data-dumps/master/zones.json",
    kind: "json",
  },
  ipls: {
    url: "https://raw.githubusercontent.com/DurtyFree/gta-v-data-dumps/master/ipls.json",
    kind: "json",
  },
  interiors: {
    url: "https://raw.githubusercontent.com/DurtyFree/gta-v-data-dumps/master/mloInteriors.json",
    kind: "json",
  },
} as const;

type Dataset = keyof typeof SOURCES;

const cache = new Map<Dataset, { expires: number; value: unknown }>();

async function loadDataset(dataset: Dataset) {
  const existing = cache.get(dataset);
  if (existing && existing.expires > Date.now()) return existing.value;

  const source = SOURCES[dataset];
  const response = await fetch(source.url, {
    cache: "force-cache",
    next: { revalidate: 86_400 },
    headers: { "user-agent": "IslandForge/1.0 (FiveM island editor)" },
  });
  if (!response.ok) throw new Error("La source DurtyFree est momentanément indisponible.");

  const text = await response.text();
  const value = source.kind === "lines"
    ? [...new Set(text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith(";")))]
    : JSON.parse(text);

  cache.set(dataset, { expires: Date.now() + 86_400_000, value });
  return value;
}

function normalize(value: unknown): string {
  return String(value ?? "").toLocaleLowerCase("fr-FR");
}

export async function GET(request: Request, context: { params: Promise<{ dataset: string }> }) {
  const { dataset: rawDataset } = await context.params;
  if (!(rawDataset in SOURCES)) {
    return NextResponse.json({ error: "Dataset GTA inconnu." }, { status: 404 });
  }

  const dataset = rawDataset as Dataset;
  const params = new URL(request.url).searchParams;
  const query = normalize(params.get("q")).trim();
  const limit = Math.min(200, Math.max(1, Number(params.get("limit")) || 80));
  const offset = Math.max(0, Number(params.get("offset")) || 0);

  try {
    const source = await loadDataset(dataset);
    let items: unknown[] = [];

    if (dataset === "objects") {
      const names = source as string[];
      const filtered = query
        ? names.filter((name) => normalize(name).includes(query))
        : names;
      const page = filtered.slice(offset, offset + limit);
      items = page.map((name) => ({
        name,
        category: name.split("_")[0] || "prop",
        hash: null,
      }));
      return NextResponse.json({
        dataset,
        source: "DurtyFree/gta-v-data-dumps",
        total: filtered.length,
        offset,
        items,
      }, { headers: { "cache-control": "private, max-age=60, stale-while-revalidate=300" } });
    }

    if (dataset === "zones") {
      const values = source as Array<{ Name: string; DisplayName?: string; Bounds?: unknown[] }>;
      items = values.filter((item) => !query || normalize(item.Name + " " + item.DisplayName).includes(query));
    } else if (dataset === "ipls") {
      const values = source as Array<{ Name: string; DlcName?: string; Position?: { X: number; Y: number; Z: number }; ExtraData?: { Name?: string; GroupName?: string; Category?: string } }>;
      items = values.filter((item) => !query || normalize(item.Name + " " + item.DlcName + " " + item.ExtraData?.Name + " " + item.ExtraData?.GroupName + " " + item.ExtraData?.Category).includes(query));
    } else {
      const values = source as Array<{ Name: string; DlcName?: string; Locations?: Array<{ Position?: { X: number; Y: number; Z: number }; FilePath?: string }> }>;
      items = values.flatMap((item) => (item.Locations ?? []).map((location, index) => ({
        name: item.Name,
        dlc: item.DlcName ?? "unknown",
        position: location.Position ?? null,
        file: location.FilePath ?? null,
        index,
      }))).filter((item) => !query || normalize(item.name + " " + item.dlc + " " + item.file).includes(query));
    }

    const total = items.length;
    return NextResponse.json({
      dataset,
      source: "DurtyFree/gta-v-data-dumps",
      total,
      offset,
      items: items.slice(offset, offset + limit),
    }, { headers: { "cache-control": "private, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Impossible de charger les données GTA.",
      source: "DurtyFree/gta-v-data-dumps",
    }, { status: 502 });
  }
}
