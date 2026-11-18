const WORKER_URL = "https://nexora-ai-visualizer.audiliga.workers.dev/generate";
const PREVIEW_ORIGIN = "https://feature-cloudflare-image-edi.nexora-home-ai-preview.pages.dev";

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Разрешён только POST-запрос." }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Allow": "POST" }
    });
  }

  let stage = "чтение multipart-формы";
  try {
    // Parse and rebuild multipart data instead of forwarding a streaming request body.
    // This avoids opaque TypeError failures when a Pages Function reuses request.body
    // in a new cross-service Request, and lets fetch generate a fresh multipart boundary.
    const form = await request.formData();

    const headers = new Headers();
    const accessKey = request.headers.get("X-NEXORA-KEY");
    if (accessKey) headers.set("X-NEXORA-KEY", accessKey);
    headers.set("Origin", request.headers.get("Origin") || PREVIEW_ORIGIN);

    stage = "передача multipart-формы Worker";
    const upstream = await fetch(WORKER_URL, {
      method: "POST",
      headers,
      body: form
    });

    stage = "возврат ответа Worker";
    const responseHeaders = new Headers();
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "application/octet-stream");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Cloudflare Pages Function: " + stage + ": " + String(error && error.message || error)
    }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
}