export async function onRequest({ env }) {
  return Response.json({
    ok: true,
    service: "nexora-home-ai-v2-preview",
    ai_service_binding_present: !!env.NEXORA_AI
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
