export async function onRequest({ request }) {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "Требуется GET." }), {
      status: 405,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Allow": "GET"
      }
    });
  }

  try {
    // The generate route expects multipart/form-data. An empty FormData
    // keeps the diagnostic request valid while the intentionally invalid
    // key makes the Worker stop at authentication, before AI generation.
    const form = new FormData();
    const upstream = await fetch(new URL("/api/generate", request.url).toString(), {
      method: "POST",
      headers: { "X-NEXORA-KEY": "nexora-diagnostic-invalid-key" },
      body: form
    });

    let details = {};
    try { details = await upstream.json(); } catch {}

    const ready = upstream.status === 401;
    const status = ready ? 200 : 502;
    return new Response(JSON.stringify({
      ok: ready,
      pagesFunction: "reachable",
      generateRoute: ready ? "reachable" : "failed",
      worker: ready ? "reachable" : "not_confirmed",
      workerStatus: upstream.status,
      aiBindingAndSecret: ready ? "configured" :
        upstream.status === 503 ? "missing_or_invalid_binding_or_secret" : "not_confirmed",
      message: ready
        ? "Pages Function and Worker are reachable; invalid diagnostic key was correctly rejected."
        : details.error || "Worker connection could not be confirmed."
    }), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      pagesFunction: "reachable",
      generateRoute: "failed",
      stage: "pages_to_generate_proxy",
      error: String(error && error.message || error)
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
}