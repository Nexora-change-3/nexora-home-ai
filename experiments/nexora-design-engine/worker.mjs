import { createD1DispatchStore } from "./model-adapters/dispatch-ledger.mjs";
import { createWorkersAiFlux2DevAdapter, MODEL_ID, PROVIDER_ID, STEPS, WIDTH, HEIGHT, GUIDANCE } from "./model-adapters/workers-ai-flux2-dev-adapter.mjs";
import { verifyRoomIdentity } from "./src/quality-gate/room-identity-gate.mjs";
import { createDesignSession } from "./src/design-brain/design-session.mjs";
import { createMoondreamWorkersAIAdapter } from "./model-adapters/workers-ai-moondream.mjs";
import { createWorkersAiDesignBrainAdapter, DESIGN_BRAIN_MODEL_ID } from "./model-adapters/workers-ai-design-brain.mjs";
import { APP_HTML } from "./app-shell.mjs";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_RESULT_BYTES = 1_650_000;
const MAX_DAILY_RENDERS = 3;
const MAX_DAILY_DESIGN_SESSIONS = 1;
const RESULT_TTL_HOURS = 24;
const ROOM_TYPES = new Set(["kitchen", "living_room", "bedroom", "bathroom", "hallway", "office", "studio", "other"]);
const MODEL = MODEL_ID;

function fail(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function securityHeaders(headers = {}) {
  return {
    ...headers,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy": "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
  };
}

function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw fail("ORIGIN_REJECTED", "Запрос отклонён: неверный источник.", 403);
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw fail("ORIGIN_REJECTED", "Межсайтовый запрос отклонён.", 403);
  }
}

function sniffImageMime(bytes) {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0,4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8,12)) === "WEBP") return "image/webp";
  return null;
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function lines(value, max = 20) {
  return String(value || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, max);
}

function validateDesignInput(input) {
  if (!input || typeof input !== "object") throw fail("INVALID_DESIGN_INPUT", "Не заполнены параметры проекта.");
  if (typeof input.sourceImageId !== "string" || input.sourceImageId.length < 16) {
    throw fail("SOURCE_IMAGE_REQUIRED", "Сначала выберите исходную фотографию.");
  }
  if (!ROOM_TYPES.has(input.roomType)) throw fail("INVALID_ROOM_TYPE", "Выберите тип помещения.");
  const userBrief = String(input.userBrief || "").trim();
  if (userBrief.length > 3000) throw fail("BRIEF_TOO_LONG", "Описание проекта слишком длинное.");
  return {
    sourceImageId: input.sourceImageId,
    roomType: input.roomType,
    stylePreference: String(input.stylePreference || "designer-led").slice(0, 80),
    userBrief,
    intendedUse: String(input.intendedUse || "").slice(0, 300),
    dimensions: input.dimensions && typeof input.dimensions === "object" ? input.dimensions : undefined,
    constraints: {
      fixed: lines(input.fixed, 20),
      preserve: lines(input.preserve, 20),
      replaceable: lines(input.replaceable, 20)
    }
  };
}

function makeConcepts(input) {
  return createDesignConcepts(input).map((item) => {
    const design = item.design_concept;
    const materials = (design.materials || []).map((x) => x.direction || x.material || String(x)).join("; ");
    const lighting = (design.lighting || []).map((x) => x.direction || String(x)).join("; ");
    const furniture = (design.furniture || []).map((x) => x.direction || String(x)).join("; ");
    const decor = (design.decor || []).map((x) => x.direction || String(x)).join("; ");
    const renderInstructions = [
      "Create a substantial, professionally designed new interior, not a colour-only refresh.",
      "DESIGN DIRECTION: " + design.concept_name + ".",
      "DESIGN THESIS: " + design.design_thesis,
      "SPATIAL STRATEGY: " + (design.layout?.strategy || ""),
      "MATERIAL SPECIFICATION: " + materials,
      "LIGHTING DESIGN: " + lighting,
      "FURNITURE DIRECTION: " + furniture,
      "DECOR AND ART DIRECTION: " + decor,
      "FOCAL POINT: " + (design.focal_point || ""),
      "DESIGN SIGNATURE: " + (design.distinctiveness_tags || []).join("; "),
      "FUNCTIONAL RATIONALE: " + (design.functional_rationale || []).join("; "),
      "RENDER REQUIREMENTS: " + (item.render_requirements || []).join("; "),
      "USER BRIEF: " + input.userBrief,
      "ROOM TYPE: " + input.roomType + ". Intended use: " + input.intendedUse,
      "FIXED ELEMENTS THAT MUST NOT CHANGE: " + input.constraints.fixed.join("; "),
      "ELEMENTS TO PRESERVE: " + input.constraints.preserve.join("; "),
      "ELEMENTS EXPLICITLY ALLOWED TO REPLACE: " + input.constraints.replaceable.join("; "),
      "Keep the exact source camera viewpoint, room envelope, perspective, windows, doors, openings, structural elements and fixed services. Do not invent additional windows, doors, appliances or room extensions.",
      "Do not alter an item listed as fixed or preserved. Unknown elements are not permission to remove or replace them.",
      "The result must visibly express this concept through its composition, furniture forms, material choices, focal point and lighting, not merely through a different colour palette.",
      "Photorealistic architectural interior photography, physically plausible construction details, realistic material texture, natural perspective, balanced exposure, premium editorial quality."
    ].filter(Boolean).join("\n");
    return {
      concept_id: design.concept_id,
      name: design.concept_name,
      thesis: design.design_thesis,
      layout: design.layout?.strategy || "",
      materials,
      lighting,
      furniture,
      focal_point: design.focal_point || "",
      functional_rationale: design.functional_rationale || "",
      render_instructions: renderInstructions
    };
  });
}

function makeAdapter(env, sourceImage = null) {
  if (!env.AI || typeof env.AI.run !== "function") throw fail("WORKERS_AI_UNAVAILABLE", "Cloudflare Workers AI is not configured for this project.", 503);
  const dispatchStore = createD1DispatchStore(env.DB);
  return createWorkersAiFlux2DevAdapter({
    AI: env.AI,
    dispatchStore,
    steps: STEPS, width: WIDTH, height: HEIGHT, guidance: GUIDANCE,
    maxImageBytes: MAX_SOURCE_BYTES,
    maxOutputBytes: MAX_RESULT_BYTES,
    storeResult: async ({ requestId, bytes, mimeType, metadata }) => {
      const qualityGate = await verifyRoomIdentity({
        AI: env.AI,
        sourceImage,
        candidateImage: { bytes, contentType: mimeType },
        expectedRoomType: sourceImage?.roomType
      });
      const finalMetadata = { ...metadata, quality_gate: qualityGate };
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + RESULT_TTL_HOURS * 60 * 60 * 1000).toISOString();
      await env.DB.prepare(
        "INSERT OR IGNORE INTO nexora_render_images (request_id, image_bytes, mime_type, metadata_json, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(requestId, bytes, mimeType, JSON.stringify(finalMetadata), createdAt, expiresAt).run();
      const stored = await env.DB.prepare(
        "SELECT request_id FROM nexora_render_images WHERE request_id = ? LIMIT 1"
      ).bind(requestId).first();
      if (!stored) throw fail("RESULT_STORAGE_FAILED", "Не удалось сохранить готовое изображение.", 503);
      return { image_ref: "nexora-render://" + requestId, quality_gate: qualityGate };
    },
    getStoredResult: async (requestId) => {
      const row = await env.DB.prepare(
        "SELECT request_id, metadata_json FROM nexora_render_images WHERE request_id = ? LIMIT 1"
      ).bind(requestId).first();
      if (!row) return null;
      let metadata;
      try { metadata = JSON.parse(row.metadata_json || "{}"); } catch { throw fail("RESULT_METADATA_CORRUPT", "Сохранённые метаданные результата повреждены.", 500); }
      return {
        request_id: requestId,
        status: "succeeded",
        image_ref: "nexora-render://" + requestId,
        provider: metadata.provider || PROVIDER_ID,
        model_id: metadata.model_id || MODEL_ID,
        model_revision: metadata.model_revision || null,
        seed: metadata.seed ?? null,
        quality_gate: metadata.quality_gate || null,
        recovered: true
      };
    }
  });
}

async function enforceRateLimit(env, request, requestId) {
  const existing = await env.DB.prepare("SELECT request_id FROM nexora_render_dispatches WHERE request_id = ? LIMIT 1").bind(requestId).first();
  if (existing) return;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await sha256(new TextEncoder().encode(ip));
  const day = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const sql = "INSERT INTO nexora_render_limits (ip_hash, utc_day, render_count, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(ip_hash, utc_day) DO UPDATE SET render_count = render_count + 1, updated_at = excluded.updated_at WHERE render_count < ? RETURNING render_count";
  const globalRow = await env.DB.prepare(sql).bind("__nexora_global__", day, now, MAX_DAILY_RENDERS).first();
  if (!globalRow) throw fail("GLOBAL_DAILY_LIMIT_REACHED", "На сегодня исчерпан бесплатный лимит NEXORA — 3 генерации на весь проект. Платная генерация не запускается.", 429);
  const ipRow = await env.DB.prepare(sql).bind(ipHash, day, now, MAX_DAILY_RENDERS).first();
  if (!ipRow) throw fail("DAILY_LIMIT_REACHED", "Для этого подключения исчерпан дневной лимит генераций.", 429);
  return { global_count: globalRow.render_count, ip_count: ipRow.render_count };
}

async function handleRender(request, env) {
  const form = await request.formData();
  const file = form.get("image");
  const requestId = String(form.get("requestId") || "");
  const consent = form.get("externalProcessingConsent") === "true";
  if (!consent) throw fail("EXTERNAL_PROCESSING_CONSENT_REQUIRED", "Перед отправкой фотографии необходимо подтвердить обработку изображения в Cloudflare Workers AI.", 403);
  if (!file || typeof file.arrayBuffer !== "function") throw fail("SOURCE_IMAGE_REQUIRED", "Выберите фотографию помещения.");
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw fail("INVALID_REQUEST_ID", "Идентификатор генерации недействителен.");
  if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) throw fail("INVALID_IMAGE_SIZE", "Фотография должна быть не больше 8 МБ.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImageMime(bytes);
  if (!mimeType || (file.type && file.type !== mimeType)) throw fail("UNSUPPORTED_IMAGE_TYPE", "Поддерживаются корректные изображения JPEG, PNG и WebP.");
  const sourceImageRef = "sha256:" + await sha256(bytes);
  const roomType=String(form.get("roomType")||""),imageWidth=Number(form.get("imageWidth")),imageHeight=Number(form.get("imageHeight"));
  if(!Number.isInteger(imageWidth)||!Number.isInteger(imageHeight)||imageWidth<=0||imageHeight<=0||Math.max(imageWidth,imageHeight)>512)throw fail("SOURCE_DIMENSIONS_EXCEEDED","Для FLUX.2 Dev изображение должно быть уменьшено до 512 пикселей по длинной стороне.");
  const designSessionId=String(form.get("designSessionId")||""),sourceImageId=String(form.get("sourceImageId")||""),conceptId=String(form.get("conceptId")||"");
  if(!/^[0-9a-f-]{36}$/i.test(designSessionId)||!sourceImageId.startsWith("sha256:")||!conceptId)throw fail("DESIGN_SESSION_REQUIRED","Сначала сформируйте концепции по исходной фотографии.");
  const sessionRow=await env.DB.prepare("SELECT source_image_id, room_type, concepts_json, expires_at FROM nexora_design_sessions WHERE session_id = ? LIMIT 1").bind(designSessionId).first();
  if(!sessionRow||sessionRow.expires_at<=new Date().toISOString())throw fail("DESIGN_SESSION_EXPIRED","Сессия проектирования истекла. Сформируйте концепции заново.",410);
  if(sessionRow.source_image_id!==sourceImageId||sessionRow.room_type!==roomType)throw fail("DESIGN_SESSION_MISMATCH","Концепции относятся к другой фотографии или типу помещения.",409);
  let savedConcepts;try{savedConcepts=JSON.parse(sessionRow.concepts_json);}catch{throw fail("DESIGN_SESSION_CORRUPT","Сохранённая сессия проектирования повреждена.",500);}
  const concept=Array.isArray(savedConcepts)?savedConcepts.find(x=>x.concept_id===conceptId):null;if(!concept||typeof concept.render_instructions!=="string")throw fail("INVALID_CONCEPT","Выбранная концепция отсутствует в сохранённой сессии.");
  await env.DB.prepare("DELETE FROM nexora_render_images WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  await enforceRateLimit(env, request, requestId);
  const adapter = makeAdapter(env, { bytes, contentType: mimeType, roomType, width: imageWidth, height: imageHeight });
  const result = await adapter.render({
    request_id: requestId,
    source_image_ref: sourceImageRef,
    source_image: { bytes, mime_type: mimeType, width: imageWidth, height: imageHeight },
    design_brief: { render_instructions: concept.render_instructions },
    safety_policy: {
      external_image_processing_consent: true,
      external_provider: PROVIDER_ID
    },
    seed: new DataView(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(requestId + ":" + conceptId))).getUint32(0, false)
  });
  return json({ ...result, concept_id: concept.concept_id, concept_name: concept.name, result_url: "/api/results/" + requestId });
}

async function handleConcepts(request,env){
 const form=await request.formData();if(form.get("externalProcessingConsent")!=="true")throw fail("EXTERNAL_PROCESSING_CONSENT_REQUIRED","Для анализа и проектирования необходимо разрешить обработку фотографии в Cloudflare Workers AI.",403);
 const file=form.get("image");if(!file||typeof file.arrayBuffer!=="function")throw fail("SOURCE_IMAGE_REQUIRED","Выберите исходную фотографию помещения.");if(file.size<=0||file.size>MAX_SOURCE_BYTES)throw fail("INVALID_IMAGE_SIZE","Фотография должна быть не больше 8 МБ.");
 const bytes=new Uint8Array(await file.arrayBuffer()),mimeType=sniffImageMime(bytes);if(!mimeType||(file.type&&file.type!==mimeType))throw fail("UNSUPPORTED_IMAGE_TYPE","Поддерживаются корректные изображения JPEG, PNG и WebP.");
 const sourceImageId="sha256:"+await sha256(bytes),input=validateDesignInput({sourceImageId,roomType:form.get("roomType"),stylePreference:form.get("stylePreference"),userBrief:form.get("userBrief"),intendedUse:form.get("intendedUse"),fixed:form.get("fixed"),preserve:form.get("preserve"),replaceable:form.get("replaceable")});
 await env.DB.prepare("DELETE FROM nexora_design_sessions WHERE expires_at <= ?").bind(new Date().toISOString()).run();const dayStart=new Date();dayStart.setUTCHours(0,0,0,0);const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM nexora_design_sessions WHERE created_at >= ?").bind(dayStart.toISOString()).first();if(Number(count?.total||0)>=MAX_DAILY_DESIGN_SESSIONS)throw fail("DAILY_DESIGN_LIMIT_REACHED","На сегодня исчерпан бесплатный лимит проектных сессий. Платные сервисы не подключаются.",429);
 if(!env.AI||typeof env.AI.run!=="function")throw fail("WORKERS_AI_UNAVAILABLE","Cloudflare Workers AI не настроен.",503);
 const session=await createDesignSession({visionAdapter:createMoondreamWorkersAIAdapter({AI:env.AI}),textAdapter:createWorkersAiDesignBrainAdapter({AI:env.AI}),sourceImage:{id:sourceImageId,bytes,contentType:mimeType},roomType:input.roomType,userBrief:input.userBrief,stylePreference:input.stylePreference,intendedUse:input.intendedUse,dimensions:input.dimensions,constraints:input.constraints});
 if(session.status!=="design_concepts_ready"||!session.ai_design?.validation?.valid||session.ai_design.concepts.length!==3)throw fail("DESIGN_SESSION_REJECTED","AI-дизайнер не сформировал три проверенные концепции.",422);
 const concepts=session.ai_design.concepts.map(x=>({concept_id:x.concept_id,name:x.name,thesis:x.design_thesis,layout:x.layout_strategy,material:x.material_palette.join("; "),lighting:x.lighting_strategy.join("; "),furniture:x.furniture_direction.join("; "),focal_point:x.focal_point,functional_rationale:x.functional_rationale,preserve:x.preserve,replace:x.replace,render_instructions:x.render_instructions}));
 const sessionId=crypto.randomUUID(),createdAt=new Date().toISOString(),expiresAt=new Date(Date.now()+RESULT_TTL_HOURS*3600000).toISOString();await env.DB.prepare("INSERT INTO nexora_design_sessions (session_id, source_image_id, room_type, concepts_json, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(sessionId,sourceImageId,input.roomType,JSON.stringify(concepts),createdAt,expiresAt).run();
 return json({session_id:sessionId,source_image_id:sourceImageId,source_image_immutable:true,concepts:concepts.map(({render_instructions,...fields})=>fields),vision_review_required:session.evidence.vision.review_required,constraint_review_required:session.evidence.constraint_ledger.requires_review,design_provider:session.ai_design.provider,design_model:session.ai_design.model_id,rendering_performed:false,expires_at:expiresAt});
}
async function handleJob(request, env, id, recover = false) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail("INVALID_REQUEST_ID", "Идентификатор генерации недействителен.");
  if (recover) {
    const result = await makeAdapter(env).recover(id);
    return json(result);
  }
  const row = await env.DB.prepare(
    "SELECT request_id, state, prompt_id, result_json, created_at, updated_at FROM nexora_render_dispatches WHERE request_id = ? LIMIT 1"
  ).bind(id).first();
  if (!row) throw fail("JOB_NOT_FOUND", "Задание не найдено.", 404);
  return json({
    request_id: row.request_id,
    status: row.state,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    updated_at: row.updated_at
  });
}

async function handleResult(request, env, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail("INVALID_REQUEST_ID", "Идентификатор результата недействителен.");
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM nexora_render_images WHERE request_id = ?").bind(id).run();
    return json({ deleted: true });
  }
  const row = await env.DB.prepare(
    "SELECT image_bytes, mime_type, expires_at FROM nexora_render_images WHERE request_id = ? LIMIT 1"
  ).bind(id).first();
  if (!row) throw fail("RESULT_NOT_FOUND", "Изображение отсутствует или срок его временного хранения истёк.", 404);
  if (row.expires_at <= new Date().toISOString()) {
    await env.DB.prepare("DELETE FROM nexora_render_images WHERE request_id = ?").bind(id).run();
    throw fail("RESULT_EXPIRED", "Срок временного хранения результата истёк. Локальная копия в браузере сохраняется.", 410);
  }
  const bytes = row.image_bytes instanceof Uint8Array ? row.image_bytes : new Uint8Array(row.image_bytes);
  return new Response(bytes, {
    status: 200,
    headers: securityHeaders({
      "content-type": row.mime_type,
      "content-length": String(bytes.byteLength),
      "content-disposition": 'inline; filename="nexora-design-result"',
      "cache-control": "private, no-store"
    })
  });
}

export default {
  async fetch(request, env) {
    try {
      assertSameOrigin(request);
      const url = new URL(request.url);
      const path = url.pathname;
      if (request.method === "GET" && path === "/") {
        return new Response(APP_HTML, { headers: securityHeaders({ "content-type": "text/html; charset=utf-8" }) });
      }
      if (request.method === "GET" && path === "/api/health") {
        return json({
          ok: true,
          app: "NEXORA Design Engine",
          version: "1.4.0",
          model: MODEL,
          provider: PROVIDER_ID,
          model_id: MODEL_ID,
          design_brain_model: DESIGN_BRAIN_MODEL_ID,
          vision_model: "@cf/moondream/moondream3.1-9B-A2B",
          design_session_limit: MAX_DAILY_DESIGN_SESSIONS,
          daily_render_limit: MAX_DAILY_RENDERS,
          paid_fallback_enabled: false,
          quality_gate: "moondream-room-identity",
          output_storage: "Cloudflare D1 temporary; browser IndexedDB persistent",
          result_ttl_hours: RESULT_TTL_HOURS,
          max_daily_renders_per_ip: MAX_DAILY_RENDERS
        });
      }
      if (request.method === "POST" && path === "/api/concepts") return await handleConcepts(request, env);
      if (request.method === "POST" && path === "/api/render") return await handleRender(request, env);
      const job = path.match(/^\/api\/jobs\/([0-9a-f-]{36})(\/recover)?$/i);
      if (job && request.method === "GET" && !job[2]) return await handleJob(request, env, job[1], false);
      if (job && request.method === "POST" && job[2] === "/recover") return await handleJob(request, env, job[1], true);
      const result = path.match(/^\/api\/results\/([0-9a-f-]{36})$/i);
      if (result && ["GET", "DELETE"].includes(request.method)) return await handleResult(request, env, result[1]);
      return json({ error: "NOT_FOUND", message: "Страница не найдена." }, 404);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : ["WORKERS_AI_FREE_QUOTA_EXHAUSTED", "GLOBAL_DAILY_LIMIT_REACHED", "DAILY_LIMIT_REACHED", "DAILY_DESIGN_LIMIT_REACHED"].includes(error.code) ? 429 : error.code === "PROMPT_REJECTED" ? 422 : 500;
      const code = error.code || "INTERNAL_ERROR";
      if (status >= 500) console.error("NEXORA_ENGINE_ERROR", code);
      const payload = {
        error: code,
        message: status >= 500 ? "Сервис не смог завершить операцию. Исходная фотография не изменена." : error.message
      };
      if (error.diagnostic_code) payload.diagnostic = { code: error.diagnostic_code, detail: error.diagnostic_detail || null };
      if (error.debug_detail) payload.diagnostic = { code: error.code || code, detail: String(error.debug_detail).slice(0, 240) };
      return json(payload, status);
    }
  }
};
