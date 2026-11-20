export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXTURE_NAMES = new Set([
  "cs_islx_bchsand_5", "cs_islx_bchsand_5_n",
  "cs_rsn_sl_wetlandsgrass2", "cs_rsn_sl_wetlandsgrass2_n",
  "cs_islx_cstcliff_0001b", "cs_rsn_sl_cstcliff_0001_n",
  "cs_rsn_dor_mntearthstonesveg02", "cs_rsn_dor_mntearthstonesveg02_n",
]);

/** Restricted same-origin proxy for the public GunWare terrain-bank texture paths. */
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!/^[a-z0-9_]+\.png$/i.test(name) || !TEXTURE_NAMES.has(name.slice(0, -4).toLowerCase())) {
    return Response.json({ error: "Texture non autorisée." }, { status: 404 });
  }

  try {
    const upstream = await fetch(`https://island.gunware.click/bank/terrain/${name.toLowerCase()}`, {
      headers: {
        accept: "image/png",
        referer: "https://island.gunware.click/",
        origin: "https://island.gunware.click",
      },
      cache: "force-cache",
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) {
      return Response.json({ error: "Texture GunWare indisponible.", status: upstream.status }, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return Response.json({ error: "Réponse de texture invalide." }, { status: 502 });
    }
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 12 * 1024 * 1024) {
      return Response.json({ error: "Taille de texture invalide." }, { status: 502 });
    }
    return new Response(bytes, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Impossible de joindre la banque de textures GunWare." }, { status: 502 });
  }
}
