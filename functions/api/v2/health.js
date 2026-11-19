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
  if (request.method !== "GET") return Response.json({ error: "Разрешён только GET-запрос." }, { status: 405 });
  if (!allowedOrigin(request.headers.get("Origin"))) return Response.json({ error: "Источник запроса не разрешён." }, { status: 403 });
  if (!env.NEXORA_AI) return Response.json({ error: "Не подключён V2 AI service binding." }, { status: 503 });
  return env.NEXORA_AI.fetch(request);
}
