export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_BRIDGE = "http://127.0.0.1:8787";
const LOCAL_TOKEN = "islandforge-local-development-only";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const base = process.env.ISLAND_EXPORT_BRIDGE_URL?.trim().replace(/\/+$/, "") || LOCAL_BRIDGE;
  const token = process.env.ISLAND_EXPORT_BRIDGE_TOKEN?.trim() || LOCAL_TOKEN;
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return Response.json({ error: "Identifiant de tâche invalide." }, { status: 400 });
  }

  try {
    const upstream = await fetch(\`${base}/api/export/jobs/${encodeURIComponent(id)}/file\`, {
      headers: { authorization: \`Bearer ${token}\` },
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
    return Response.json({
      code: "bridge_unavailable",
      error: "Le worker local ne répond pas. Vérifie que l'application a été lancée avec npm run dev.",
    }, { status: 502 });
  }
}
