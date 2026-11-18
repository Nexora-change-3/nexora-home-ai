export async function onRequest({ request }) {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "Разрешён только GET." }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  try {
    const upstream = await fetch("https://nexora-ai-visualizer.audiliga.workers.dev/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NEXORA-KEY": "nexora-diagnostic-invalid-key",
        "Origin": "https://feature-cloudflare-image-edi.nexora-home-ai-preview.pages.dev"
      },
      body: "{}"
    });

    let details = {};
    try { details = await upstream.json(); } catch {}

    const ready = upstream.status === 401;
    return new Response(JSON.stringify({
      ok: ready,
      pagesFunction: "reachable",
      worker: ready ? "reachable" : "responded_with_error",
      workerStatus: upstream.status,
      aiBindingAndSecret: ready ? "configured" : upstream.status === 503 ? "missing_or_invalid_binding_or_secret" : "not_confirmed",
      message: details.error || (ready ? "Прокси, Worker, AI binding и серверный секрет отвечают штатно. Для генерации нужен пользовательский ключ." : "Проверка Worker не пройдена.")
    }), {
      status: ready ? 200 : 502,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      pagesFunction: "reachable",
      worker: "unreachable",
      stage: "pages_to_worker",
      error: String(error && error.message || error)
    }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
}