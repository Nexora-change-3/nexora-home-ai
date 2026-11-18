const ALLOWED_ORIGINS = new Set([
  "https://nexora-change-3.github.io",
  "https://feature-cloudflare-image-edi.nexora-home-ai-preview.pages.dev"
]);
const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

function json(data, status, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-NEXORA-KEY";
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-NEXORA-KEY",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Источник запроса не разрешён." }, 403, "");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== "POST") return json({ error: "Разрешён только POST-запрос." }, 405, origin);
    if (!env.AI) return json({ error: "В Worker не подключена привязка Workers AI (AI)." }, 503, origin);
    if (!env.NEXORA_ACCESS_KEY || env.NEXORA_ACCESS_KEY.length < 24) return json({ error: "В Worker не настроен секрет NEXORA_ACCESS_KEY." }, 503, origin);
    if (request.headers.get("X-NEXORA-KEY") !== env.NEXORA_ACCESS_KEY) return json({ error: "Неверный ключ доступа." }, 401, origin);
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 8 * 1024 * 1024) return json({ error: "Размер запроса превышает 8 МБ." }, 413, origin);
    try {
      const incoming = await request.formData();
      const roomImage = incoming.get("room_image");
      const styleReference = incoming.get("style_reference");
      const legacyStyle = incoming.get("input_image_0");
      const legacyRoom = incoming.get("input_image_1");
      const modernMode = !!roomImage;
      const room = modernMode ? roomImage : legacyRoom;
      const style = modernMode ? styleReference : legacyStyle;
      if (!room || typeof room.arrayBuffer !== "function")
        return json({ error: "Загрузите фотографию комнаты." }, 400, origin);
      if (style && typeof style.arrayBuffer !== "function")
        return json({ error: "Референс стиля должен быть файлом изображения." }, 400, origin);
      if (!room.type.startsWith("image/") || (style && !style.type.startsWith("image/")))
        return json({ error: "Загруженные файлы должны быть изображениями." }, 400, origin);
      if (room.size > 3 * 1024 * 1024 || (style && style.size > 3 * 1024 * 1024))
        return json({ error: "Каждая подготовленная фотография должна быть меньше 3 МБ." }, 413, origin);

      const form = new FormData();
      let prompt;
      if (modernMode) {
        form.set("input_image_0", room, "room.jpg");
        if (style) form.set("input_image_1", style, "style-reference.jpg");
        const styleName = String(incoming.get("style_name") || "Современный").slice(0, 80);
        const wishes = String(incoming.get("user_prompt") || "").slice(0, 500);
        prompt = `Redesign image 0 as the SAME real room in the ${styleName} interior design style. Preserve the exact room architecture and camera view: keep walls, wall corners, ceiling height, floor level, windows, doors, openings, room proportions, perspective and layout unchanged. Do not invent, remove, move or resize architectural features. Keep the composition and camera position. Change only interior finishes, furniture, lighting and decor as appropriate for the requested style. Photorealistic professional interior visualization. ${style ? "Use image 1 as an additional visual style and material reference, while preserving the room in image 0." : "Use a coherent style interpretation with realistic materials and furniture."} ${wishes}`;
      } else {
        if (!style) return json({ error: "Для старого сценария нужны фотографии стиля и комнаты." }, 400, origin);
        form.set("input_image_0", style, "style.jpg");
        form.set("input_image_1", room, "room.jpg");
        prompt = "Use image 1 as the exact room to redesign. Apply the interior design style, color palette, materials, furniture language and lighting from image 0. Preserve the original room geometry, camera viewpoint, perspective, walls, ceiling height, windows, doors, openings and overall layout. Do not move or invent windows or doors. Do not alter structural elements. Create a photorealistic interior design visualization of this same room.";
      }
      form.set("prompt", prompt);
      const outputWidth = Number(incoming.get("output_width") || 1024);
      const outputHeight = Number(incoming.get("output_height") || 768);
      if (!Number.isInteger(outputWidth) || !Number.isInteger(outputHeight) || outputWidth < 256 || outputWidth > 1920 || outputHeight < 256 || outputHeight > 1920)
        return json({ error: "Размер результата должен быть от 256 до 1920 пикселей по каждой стороне." }, 400, origin);
      form.set("width", String(outputWidth));
      form.set("height", String(outputHeight));
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
        ...corsHeaders(origin)
      }});
    } catch (error) {
      const message = String(error && error.message || error);
      const limited = /quota|neuron|daily limit|exceed/i.test(message);
      return json({ error: limited ? "Лимит Cloudflare Workers AI исчерпан. Дождитесь сброса квоты; платная оплата не подключается автоматически." : "Ошибка обработки изображения: " + message }, limited ? 429 : 502, origin);
    }
  }
};
