export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bridgeConfig() {
  const base = process.env.ISLAND_EXPORT_BRIDGE_URL?.trim().replace(/\/+$/, "");
  const token = process.env.ISLAND_EXPORT_BRIDGE_TOKEN?.trim();
  return { base, token };
}

export async function POST(request: Request) {
  const { base, token } = bridgeConfig();
  if (!base) {
    return Response.json({
      code: "bridge_missing",
      error: "Le service d'export natif CodeWalker n'est pas configuré. Utilise l'export source OBJ/GLB ou configure ISLAND_EXPORT_BRIDGE_URL.",
    }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || !("params" in payload) || !("gen" in payload)) {
    return Response.json({ error: "Paramètres d'export incomplets." }, { status: 400 });
  }
  const gen = (payload as { gen?: unknown }).gen;
  if (gen !== 8 && gen !== 9) {
    return Response.json({ error: "La génération du jeu doit être gen8 ou gen9." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${base}/api/export/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: { "content-type": contentType, "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bridge inaccessible.";
    return Response.json({ code: "bridge_unavailable", error: `Impossible de joindre le service d'export : ${message}` }, { status: 502 });
  }
}
