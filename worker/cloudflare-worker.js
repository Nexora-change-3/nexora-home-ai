const ALLOWED_ORIGINS = new Set([
  "https://369b7a54.nexora-home-ai-preview.pages.dev"
]);
function isAllowedOrigin(origin) {
  try {
    if (ALLOWED_ORIGINS.has(origin)) return true;
    const url = new URL(origin);
    const labels = url.hostname.split(".");
    return url.protocol === "https:" && labels.length === 4 &&
      labels[1] === "nexora-home-ai-preview" && labels[2] === "pages" &&
      labels[3] === "dev" && /^[a-f0-9]{8}$/.test(labels[0]);
  } catch {
    return false;
  }
}

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

const STYLE_PROFILES = {"Japandi":{"identity":"Слияние японской сдержанности и скандинавского уюта; спокойствие через пустоту, пропорции и ремесленные материалы.","composition":"Низкий визуальный горизонт, свободные проходы, асимметричный баланс, немного крупных предметов, ощущение воздуха.","furniture":"Низкие диваны и кровати, простые деревянные платформы, лаконичные шкафы без ручек, лёгкие кресла с натуральной обивкой.","materials":"Светлый дуб и ясень, матовая штукатурка, бумажные и льняные фактуры, керамика ручной работы, натуральный камень в малых дозах.","palette":"Тёплый белый, овсяный, песочный, светлый дуб, приглушённый графит как редкий контурный акцент.","lighting":"Мягкий рассеянный свет, бумажные подвесы, низкие торшеры, скрытая подсветка без блеска.","signature_details":"Японские ширмы или реечные элементы, низкие композиции, один выразительный керамический объект, деликатная асимметрия.","avoid":"Пышная классика, блестящий металл, насыщенная декоративность, тяжёлые высокие гарнитуры, визуальный беспорядок."},"Современный":{"identity":"Архитектурный современный интерьер с ясной геометрией, точной функциональностью и технологичной аккуратностью.","composition":"Чёткое зонирование, выверенные оси, встроенные объёмы хранения, контраст крупных плоскостей и открытого пространства.","furniture":"Модульные диваны прямой геометрии, лаконичные кресла, консоли и столы с чёткими контурами, встроенные шкафы в плоскость стен.","materials":"Крупноформатный керамогранит, гладкий шпон, матовый металл, стекло, окрашенные панели, однотонные ткани.","palette":"Нейтральная база с графитовыми, серо-бежевыми или глубокими акцентами; контраст светлых плоскостей и тёмных линий.","lighting":"Линейные профили, трековые системы, встроенные потолочные светильники, направленный акцентный свет.","signature_details":"Монолитные встроенные блоки, тонкие металлические профили, чистые стыки материалов, графичные световые линии.","avoid":"Рустикальные детали, избыток ручной керамики, винтажные силуэты, классические молдинги, случайная эклектика."},"Тёплый минимализм":{"identity":"Минимализм, в котором уют создают тактильность, мягкие переходы и тёплый свет, а не декор.","composition":"Спокойные цельные плоскости, мягкие переходы между зонами, минимум предметов, крупные формы и свободные поверхности.","furniture":"Простые объёмные диваны, мягкие кресла, низкие столики, встроенное хранение, округлённые углы без сложной скульптурности.","materials":"Натуральный дуб или орех, микробетон, матовая краска, шерсть, букле, лён, мягкий камень.","palette":"Сливочный, кремовый, тёплый greige, карамельный древесный, тауп; низкий контраст и тональные сочетания.","lighting":"Тёплая температура света, скрытые карнизы и ниши, тканевые абажуры, локальные лампы и мягкие световые слои.","signature_details":"Тактильные ткани, мягкие скругления, тональные сочетания, один-два предмета ручной работы.","avoid":"Холодная стерильная белизна, резкий чёрно-белый контраст, индустриальная грубость, избыток мелкого декора."},"Современная классика":{"identity":"Современная интерпретация классической архитектуры: элегантность, пропорции и сдержанная декоративность.","composition":"Симметричные или уравновешенные оси, оформленные стены, ясные композиционные центры, парадная, но не перегруженная расстановка.","furniture":"Диваны с классическими пропорциями и современной обивкой, кресла с мягкими подлокотниками, консоли, столы с каменными или деревянными поверхностями.","materials":"Молдинги, паркет ёлочкой, натуральный камень, шпон, матовая латунь или никель, бархат и плотный лён.","palette":"Слоновая кость, тёплый серый, тауп, глубокий синий или зелёный в акцентах, древесные оттенки.","lighting":"Декоративные люстры современной формы, парные бра, настольные лампы, акцентное освещение картин и архитектурных деталей.","signature_details":"Стеновые панели и молдинги, карнизы, симметричные бра, тонкие металлические акценты, выразительный паркет.","avoid":"Дворцовая пышность, тяжёлые позолоченные предметы, чрезмерный барочный декор, полностью гладкие безликие стены."},"Organic Modern":{"identity":"Современная природная эстетика, где главную роль играют скульптурные органические формы и выразительная фактура материалов.","composition":"Плавные переходы, мягкие группы мебели, округлые острова и столы, визуально текучие композиции без жёсткой симметрии.","furniture":"Изогнутые диваны, кресла-булы, столы неправильной округлой формы, скульптурные тумбы, массивные, но мягкие по контуру предметы.","materials":"Травертин, известняк, фактурная штукатурка, массив дерева, матовая керамика, букле и грубоватый лён.","palette":"Песочный, глина, тёплый белый, карамель, оливковый и природные каменные оттенки.","lighting":"Скульптурные подвесы, мягкие отражённые световые слои, локальный свет на фактурных стенах.","signature_details":"Монолитные округлые столики, крупная керамика, плавные ниши, природные неровности и тактильные поверхности.","avoid":"Жёсткая модульная геометрия, индустриальные треки как главный акцент, классические молдинги, холодный глянец."},"Mid-century Modern":{"identity":"Узнаваемый дизайн середины XX века: функциональные предметы, тёплое дерево и выразительные мебельные силуэты.","composition":"Открытая планировка, свободно стоящая мебель на ножках, читаемые зоны, композиция вокруг знаковых предметов.","furniture":"Кресла с деревянным каркасом, диваны на тонких ножках, комоды из ореха, круглые столы, мебель с коническими опорами.","materials":"Орех и тик, шпон, кожа, шерсть, рифлёное стекло, эмаль, латунь и керамика.","palette":"Орех, горчичный, оливковый, ржаво-терракотовый, кремовый, тёмно-бирюзовый точечными акцентами.","lighting":"Графичные торшеры и подвесы, шарообразные плафоны, направленный свет на мебель и арт-объекты.","signature_details":"Конические ножки, веерные или радиусные фасады, винтажная графика, выразительное кресло, геометрический текстиль.","avoid":"Современные безручечные монолитные гарнитуры, обилие камня, дворцовая классика, бесформенная органическая мебель."},"Лофт":{"identity":"Индустриальная эстетика с честными конструкциями, материальной выразительностью и функциональной мебелью.","composition":"Открытые зоны, визуально читаемые конструкции, контраст грубых поверхностей и аккуратных мебельных групп.","furniture":"Крупные простые диваны, металлические стеллажи, массивные столы, кожа, функциональные кресла и открытые системы хранения.","materials":"Кирпич, бетон или микробетон, чёрная сталь, состаренное дерево, стекло в металлических рамах, кожа.","palette":"Графит, угольный, кирпичный, табачный, бетонный серый, тёплое дерево; допускаются более сильные контрасты.","lighting":"Трековые системы, металлические подвесы, направленные прожекторы, крупные индустриальные светильники.","signature_details":"Чёрные оконные профили, открытые стеллажи, видимые инженерные элементы там, где это реалистично, кирпичная или бетонная фактура.","avoid":"Стерильная пастельная минималистичность, классические молдинги, избыток мягкого букле и декоративная позолота."},"Средиземноморский":{"identity":"Солнечный южный интерьер с архитектурной пластикой, естественными материалами и расслабленной атмосферой.","composition":"Мягкие арочные проёмы и ниши, округлые переходы, свободная расстановка, естественные центры и ощущение света.","furniture":"Низкие диваны с льняной обивкой, деревянные столы, плетёные кресла, простые встроенные скамьи, керамические столики.","materials":"Известковая штукатурка, терракота, натуральный камень, светлое дерево, ротанг, керамика и лён.","palette":"Молочный, песочный, известковый белый, охра, терракота, оливковый, цвет выгоревшей земли.","lighting":"Тёплый естественный свет, керамические и плетёные подвесы, мягкие бра, световые ниши.","signature_details":"Арки и ниши там, где позволяет архитектура, терракотовые акценты, ручная керамика, текстиль с естественной фактурой.","avoid":"Холодные серые палитры, хромированный хай-тек, чёрные индустриальные конструкции как доминирующий мотив."},"Ар-деко":{"identity":"Графичный декоративный стиль с геометрией, контрастом, симметрией и тщательно выбранными эффектными материалами.","composition":"Чёткие оси и симметрия, выразительные фокусные точки, ритмичные панели, контрастные геометрические плоскости.","furniture":"Обтекаемые диваны с чётким силуэтом, кресла с выразительной спинкой, столики из камня и металла, мебель с радиусными фасадами.","materials":"Лакированный шпон, мрамор, латунь, бронза, рифлёное или тонированное стекло, бархат, глянцевые акценты.","palette":"Чёрный и кремовый, глубокий изумрудный, бордовый, тёмный шоколад, латунь; контраст выше, чем в остальных стилях.","lighting":"Эффектные многоярусные люстры, геометрические бра, направленный свет на камень и металл.","signature_details":"Геометрический рисунок, веерные мотивы, контрастные вставки, зеркала с выразительной рамой, латунные линии.","avoid":"Полная визуальная нейтральность, рустикальные фактуры, случайный минималистичный декор, скандинавская простота."},"Luxury":{"identity":"Индивидуальный премиальный интерьер, где впечатление создают масштаб, качество исполнения и цельность дорогих материалов, а не демонстративный декор.","composition":"Чистые крупные объёмы, точная встроенная архитектура, продуманная иерархия зон, минимум визуального шума и безупречные стыки.","furniture":"Индивидуальная встроенная мебель, крупные диваны с дорогой обивкой, авторские кресла, монолитные столы и скрытые системы хранения.","materials":"Натуральный камень крупного формата, выразительный шпон, металл с деликатной отделкой, стекло, кожа, премиальные ткани.","palette":"Сложные нейтральные оттенки, глубокий древесный, каменные тона, бронза или тёмный металл; точечные глубокие акценты.","lighting":"Многосценарное архитектурное освещение, скрытые профили, акцентный свет на фактуры, декоративные авторские светильники.","signature_details":"Индивидуальные панели во всю высоту, интегрированные двери и хранение, каменные монолиты, скрытая техника, безупречная деталировка.","avoid":"Показная позолота, обилие блеска, типовой мебельный набор, дешёвые имитации камня, случайная декоративная роскошь."}};

function json(data, status, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (isAllowedOrigin(origin)) {
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
    if (!isAllowedOrigin(origin)) return json({ error: "Источник запроса не разрешён." }, 403, "");
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
        const styleProfile = STYLE_PROFILES[styleName] || STYLE_PROFILES["Современный"];
        const styleProfilePrompt = styleProfile ? [
          `STYLE IDENTITY: ${styleProfile.identity}`,
          `SPATIAL COMPOSITION: ${styleProfile.composition}`,
          `FURNITURE LANGUAGE: ${styleProfile.furniture}`,
          `MATERIAL SPECIFICATION: ${styleProfile.materials}`,
          `COLOR PALETTE: ${styleProfile.palette}`,
          `LIGHTING DESIGN: ${styleProfile.lighting}`,
          `SIGNATURE DETAILS: ${styleProfile.signature_details}`,
          `STRICTLY AVOID: ${styleProfile.avoid}`
        ].join("\n") : "";
        const variantIndex = Number(incoming.get("variant_index") || 0);
        const conceptDirections = {
          1: "CONCEPT 1 — WARM TACTILE RESIDENCE: make this the most natural, intimate and tactile direction. Use warm timber as a major designed surface, honed or softly textured stone, tactile upholstery, woven natural textiles and layered warm lighting. Choose generous, grounded furniture with rounded or softened profiles. Build a coherent material story with visible craftsmanship; avoid a generic beige makeover.",
          2: "CONCEPT 2 — ARCHITECTURAL STATEMENT: make this the most expressive and architectural direction. Introduce a strong focal surface or bespoke built-in composition, bolder material contrast, a more sculptural furniture silhouette, confident dark or mineral accents and deliberate directional lighting. Use fewer but more characterful pieces and crisp detailing. It must read as a different design project, not a palette variation.",
          3: "CONCEPT 3 — AIRY CONTEMPORARY RETREAT: make this the lightest, most spacious-feeling and refined direction. Favor pale mineral finishes, light-toned timber, soft tonal layering, visually light furniture, subtle curves, discreet integrated storage and carefully placed reflective or translucent details where appropriate. Use bright but nuanced daylight and quiet layered lighting. Do not repeat the furniture character or focal treatment of concepts 1 and 2."
        };
        const concept = conceptDirections[variantIndex] || "Create a complete, coherent interpretation of the requested interior style with realistic premium materials and purposeful furniture choices.";
        prompt = `Act as a senior interior architect and create a complete, professionally art-directed redesign of image 0 in the ${styleName} style. The selected style profile is mandatory and must govern the design, not merely the colors. ${styleProfilePrompt} ${concept} Preserve the real room's architecture and original camera viewpoint exactly: keep walls, corners, ceiling height, windows, doors, openings, room proportions, perspective and fixed structural features. Never invent, remove, move or resize architectural features. Preserve the camera position and room geometry, but replace the existing design language. Redesign visible movable and finish elements as a coordinated project: furniture, cabinetry and fronts, worktops, backsplash, wall and floor finishes, upholstery, lighting fixtures, textiles and decor. Make purposeful furniture and joinery choices that visibly express the chosen style and concept. The result must look like a genuinely new, coherent interior design, not a recoloring or superficial staging. Keep existing appliances and functional fixtures recognizable, unobstructed and realistically integrated in plausible positions. Maintain believable circulation and practical clearances. Avoid clutter, duplicate objects, malformed furniture, ambiguous objects, impossible construction and excessive decoration. Photorealistic premium interior-design photography, credible material texture, precise joinery, realistic light and shadow. ${style ? "Use image 1 only as a style, material and mood reference; image 0 is the sole room to redesign. Do not copy the reference room's architecture, layout or camera. Translate its design language into the actual geometry of image 0." : "Interpret the selected style profile faithfully and do not preserve the source room's existing decor or palette unless the profile requires it."} ${wishes}`;
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
