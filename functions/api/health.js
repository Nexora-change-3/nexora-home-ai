export async function onRequest({ request }) {
  if (request.method !== "GET") return new Response(JSON.stringify({ ok: false, error: "Разрешён только GET." }), { status: 405, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  try {
    const upstream = await fetch(new URL("/api/generate", request.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-NEXORA-KEY": "nexora-diagnostic-invalid-key" },
      body: "{}"
    });
    let details = {};
    try { details = await upstream.json(); } catch {}
    const ready = upstream.status === 401;
    return new Response(JSON.stringify({
      ok: ready, pagesFunction: "reachable",
      generateRoute: ready ? "reachable" : "failed",
      worker: ready ? "reachable" : "not_confirmed",
      workerStatus: upstream.status,
      aiBindingAndSecret: ready ? "configured" : upstream.status === 503 ? "missing_or_invalid_binding_or_secret" : "not_confirmed",
      message: ready ? "Маршрут /api/generate проходит через Pages Function к Worker. AI binding и серверный секрет доступны. Тестовый ключ отклонён штатно." : details.error || "Проверка маршрута генерации не пройдена."
    }), { status: ready ? 200 : 502, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, pagesFunction: "reachable", generateRoute: "failed", stage: "pages_to_generate_proxy", error: String(error && error.message || error) }), { status: 502, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }
}