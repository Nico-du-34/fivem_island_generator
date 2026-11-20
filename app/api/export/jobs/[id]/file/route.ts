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
    const upstream = await fetch(`${base}/api/export/jobs/${encodeURIComponent(id)}/file`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") ?? "application/zip");
    headers.set("cache-control", "no-store");
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("content-disposition", disposition);
    const length = upstream.headers.get("content-length");
    if (length) headers.set("content-length", length);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ code: "bridge_unavailable", error: "Le fichier d'export est inaccessible." }, { status: 502 });
  }
}
