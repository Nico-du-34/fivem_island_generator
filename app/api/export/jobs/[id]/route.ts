export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const base = process.env.ISLAND_EXPORT_BRIDGE_URL?.trim().replace(/\/+$/, "");
  const token = process.env.ISLAND_EXPORT_BRIDGE_TOKEN?.trim();
  if (!base) {
    return Response.json({ code: "bridge_missing", error: "Service d'export natif non configuré." }, { status: 503 });
  }

  const { id } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return Response.json({ error: "Identifiant de tâche invalide." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${base}/api/export/jobs/${encodeURIComponent(id)}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json({ code: "bridge_unavailable", error: "Le service d'export ne répond pas." }, { status: 502 });
  }
}
