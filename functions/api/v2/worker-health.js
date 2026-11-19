function allowedOrigin(origin) {
  try {
    const url = new URL(origin || "");
    return url.protocol === "https:" && (
      url.hostname === "nexora-home-ai-v2-preview.pages.dev" ||
      /^[a-f0-9]{8}\.nexora-home-ai-v2-preview\.pages\.dev$/.test(url.hostname)
    );
  } catch { return false; }
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return Response.json({ error: "GET only" }, { status: 405 });
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigin(origin)) return Response.json({ error: "Origin denied" }, { status: 403 });
  if (!env.NEXORA_AI) return Response.json({ error: "Missing service binding" }, { status: 503 });
  const internal = new Request("https://nexora-ai-visualizer-v2.internal/api/v2/health", {
    method: "GET",
    headers: request.headers
  });
  return env.NEXORA_AI.fetch(internal);
}
