const APP_ORIGIN = "https://nexora-change-3.github.io";
const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

function json(data, status, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (origin === APP_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = APP_ORIGIN;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-NEXORA-KEY";
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== APP_ORIGIN) return json({ error: "Источник запроса не разрешён." }, 403, "");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": APP_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-NEXORA-KEY",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    }});
    if (request.method !== "POST") return json({ error: "Разрешён только POST-запрос." }, 405, origin);
    if (!env.AI) return json({ error: "В Worker не подключена привязка Workers AI (AI)." }, 503, origin);
    if (!env.NEXORA_ACCESS_KEY || env.NEXORA_ACCESS_KEY.length < 24) return json({ error: "В Worker не настроен секрет NEXORA_ACCESS_KEY." }, 503, origin);
    if (request.headers.get("X-NEXORA-KEY") !== env.NEXORA_ACCESS_KEY) return json({ error: "Неверный ключ доступа." }, 401, origin);
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 8 * 1024 * 1024) return json({ error: "Размер запроса превышает 8 МБ." }, 413, origin);
    try {
      const incoming = await request.formData();
      const style = incoming.get("input_image_0");
      const room = incoming.get("input_image_1");
      if (!style || !room || typeof style.arrayBuffer !== "function" || typeof room.arrayBuffer !== "function")
        return json({ error: "Нужны две фотографии: стиль и комната." }, 400, origin);
      if (!style.type.startsWith("image/") || !room.type.startsWith("image/"))
        return json({ error: "Оба файла должны быть изображениями." }, 400, origin);
      if (style.size > 3 * 1024 * 1024 || room.size > 3 * 1024 * 1024)
        return json({ error: "Каждая подготовленная фотография должна быть меньше 3 МБ." }, 413, origin);
      const form = new FormData();
      form.set("prompt", "Use image 1 as the exact room to redesign. Apply the interior design style, color palette, materials, furniture language and lighting from image 0. Preserve the original room geometry, camera viewpoint, perspective, walls, ceiling height, windows, doors, openings and overall layout. Do not move or invent windows or doors. Do not alter structural elements. Create a photorealistic interior design visualization of this same room.");
      form.set("input_image_0", style, "style.jpg");
      form.set("input_image_1", room, "room.jpg");
      form.set("width", "1024");
      form.set("height", "1024");
      const serialized = new Response(form);
      const result = await env.AI.run(MODEL, { multipart: {
        body: serialized.body,
        contentType: serialized.headers.get("content-type")
      }});
      if (!result || !result.image) throw new Error("Модель не вернула изображение.");
      const binary = atob(result.image);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Response(bytes, { status: 200, headers: {
        "Content-Type": "image/png",
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": APP_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-NEXORA-KEY",
        "Vary": "Origin"
      }});
    } catch (error) {
      const message = String(error && error.message || error);
      const limited = /quota|neuron|daily limit|exceed/i.test(message);
      return json({ error: limited ? "Бесплатный дневной лимит Cloudflare исчерпан. Новые запросы станут доступны после сброса квоты; платная оплата не подключается автоматически на Workers Free." : "Ошибка обработки изображения: " + message }, limited ? 429 : 502, origin);
    }
  }
};
