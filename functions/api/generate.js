export async function onRequest(context) {
  const { request } = context;
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Разрешён только POST-запрос." }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Allow": "POST" }
    });
  }
  try {
    const headers = new Headers();
    const contentType = request.headers.get("Content-Type");
    const accessKey = request.headers.get("X-NEXORA-KEY");
    if (contentType) headers.set("Content-Type", contentType);
    if (accessKey) headers.set("X-NEXORA-KEY", accessKey);
    headers.set("Origin", "https://feature-cloudflare-image-edi.nexora-home-ai-preview.pages.dev");
    const body = await request.arrayBuffer();
    const upstream = await fetch("https://nexora-ai-visualizer.audiliga.workers.dev/generate", { method: "POST", headers, body });
    const responseHeaders = new Headers();
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "application/octet-stream");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Не удалось связаться с Cloudflare AI: " + String(error && error.message || error) }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
}
