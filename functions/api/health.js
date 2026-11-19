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
    // Valid multipart request with a deliberately invalid key:
    // the Worker should reject it before any AI call or image generation.
    const form = new FormData();
    const upstream = await fetch(new URL("/api/generate", request.url).toString(), {
      method: "POST",
      headers: { "X-NEXORA-KEY": "nexora-diagnostic-invalid-key" },
      body: form
    });

    let details = {};
    try { details = await upstream.json(); } catch {}

    const reachable = upstream.status === 401;
    return new Response(JSON.stringify({
      ok: reachable,
      pagesFunction: "reachable",
      generateRoute: reachable ? "reachable" : "failed",
      worker: reachable ? "reachable" : "not_confirmed",
      workerStatus: upstream.status,
      authenticationGate: reachable ? "responding" : "not_confirmed",
      aiBindingAndRealKey: "not_tested",
      message: reachable
        ? "Pages Function and Worker are reachable; the intentionally invalid diagnostic key was rejected. AI binding and the real access key were not tested."
        : details.error || "Worker connection could not be confirmed."
    }), {
      status: reachable ? 200 : 502,
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