import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.mjs";
import { APP_HTML } from "../app-shell.mjs";

function sameOriginRequest(path, init = {}) {
  return new Request("https://nexora-engine.example" + path, {
    ...init,
    headers: { origin: "https://nexora-engine.example", ...(init.headers || {}) }
  });
}

test("serves the standalone app with restrictive security headers", async () => {
  const response = await worker.fetch(sameOriginRequest("/"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  const html = await response.text();
  assert.match(html, /NEXORA Design Engine/);
  assert.match(html, /FLUX\.2 Dev/);
  assert.match(html, /Llama 3\.3 70B/);
  assert.match(html, /NEXORA не сохраняет исходное фото на сервере/);
  assert.doesNotMatch(html, /\\\\1|\\\\2/);
  assert.match(html, /externalProcessingConsent/);
  assert.match(html, /indexedDB/);
});

test("serves health metadata without exposing credentials or image data", async () => {
  const response = await worker.fetch(sameOriginRequest("/api/health"), {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.provider, "cloudflare-workers-ai");
  assert.match(body.model, /flux-2-dev/);
  assert.equal(body.design_brain_model, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  assert.equal(body.version, "1.4.0");
  assert.equal(body.design_session_limit, 1);
  assert.equal(body.paid_fallback_enabled, false);
  assert.equal(body.quality_gate, "moondream-room-identity-only");
  assert.equal(body.output_storage, "Cloudflare D1 temporary; browser IndexedDB persistent");
  assert.equal(JSON.stringify(body).includes("token"), false);
});

test("rejects cross-origin browser requests", async () => {
  const response = await worker.fetch(new Request("https://nexora-engine.example/api/health", {
    headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_REJECTED");
});

test("requires consent before photo analysis", async () => {
  const form = new FormData();
  form.append("externalProcessingConsent", "false");
  const response = await worker.fetch(sameOriginRequest("/api/concepts", { method: "POST", body: form }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "EXTERNAL_PROCESSING_CONSENT_REQUIRED");
});

test("requires an original image for AI design analysis", async () => {
  const form = new FormData();
  form.append("externalProcessingConsent", "true");
  const response = await worker.fetch(sameOriginRequest("/api/concepts", { method: "POST", body: form }), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "SOURCE_IMAGE_REQUIRED");
});

test("runs Moondream photo analysis and Llama Design Brain through the full concepts route", async () => {
  const sessions = new Map();
  const db = { prepare(sql) { let values=[]; return { bind(...args) { values=args; return this; }, async run() { if (sql.startsWith("INSERT INTO nexora_design_sessions")) { sessions.set(values[0], { session_id:values[0], source_image_id:values[1], room_type:values[2], concepts_json:values[3], created_at:values[4], expires_at:values[5] }); } return { meta:{changes:1} }; }, async first() { if (sql.includes("COUNT(*)")) return { total:sessions.size }; return null; } }; } };
  const calls=[];
  const AI={ async run(model,args) {
    calls.push(model);
    if (model.includes("moondream")) return { answer: JSON.stringify({ observations:[{ observation_id:"wall-1", label:"visible kitchen wall", category:"architecture", confidence:0.94, visibility:"clear", image_region:{x:0.1,y:0.1,width:0.8,height:0.7} },{ observation_id:"window-1",label:"existing window",category:"opening",confidence:0.91,visibility:"clear",image_region:{x:0.15,y:0.2,width:0.25,height:0.35} }], uncertainties:[], dimension_hypotheses:[] }) };
    const user=args.messages[1].content;
    const json=user.split("Create three concepts using this input JSON:\n")[1].split("\n\nRequired response shape:")[0];
    const input=JSON.parse(json);
    const concepts=[
      {concept_id:"architectural-clarity",name:"Architectural Limestone",design_thesis:"A calm architectural kitchen defined by monolithic limestone and quiet planes.",layout_strategy:"Keep the existing working triangle and create a strong stone island focal point.",material_palette:["honed ivory limestone island","warm white matte cabinetry","brushed bronze details"],lighting_strategy:["concealed linear task lighting","sculptural pendant above island"],furniture_direction:["minimal oak stools with soft upholstery"],focal_point:"monolithic limestone island",functional_rationale:"Clear preparation zones and uninterrupted circulation.",preserve:["existing window and room shell"],replace:["cabinet fronts and worktops"],render_instructions:"Create a photorealistic architectural limestone kitchen redesign while preserving the exact room shell and camera view."},
      {concept_id:"warm-natural",name:"Warm Natural Living",design_thesis:"A tactile family kitchen layered with natural oak, warm clay and soft light.",layout_strategy:"Retain the current layout and introduce a generous oak island with a warm social edge.",material_palette:["natural oak joinery","warm clay backsplash","honed beige stone"],lighting_strategy:["opal globe pendants","warm under-shelf illumination"],furniture_direction:["rounded timber stools and woven textures"],focal_point:"oak island with warm clay backsplash",functional_rationale:"Durable tactile surfaces support everyday family cooking.",preserve:["existing window and room shell"],replace:["cabinet fronts and backsplash"],render_instructions:"Create a photorealistic warm natural kitchen redesign with oak and clay materials, preserving the exact room shell and camera view."},
      {concept_id:"expressive-contemporary",name:"Expressive Contemporary",design_thesis:"A confident contemporary kitchen combining dark joinery and a sculptural stone centerpiece.",layout_strategy:"Preserve service positions and use contrasting full-height joinery to frame the island.",material_palette:["smoked walnut cabinetry","dramatic veined stone","dark bronze accents"],lighting_strategy:["linear ceiling lighting","bold sculptural pendant"],furniture_direction:["slim black metal stools with leather seats"],focal_point:"dramatic veined stone island",functional_rationale:"Contrasting work zones remain practical and legible.",preserve:["existing window and room shell"],replace:["cabinet fronts and worktops"],render_instructions:"Create a photorealistic expressive contemporary kitchen with smoked walnut and dramatic stone, preserving the exact room shell and camera view."}
    ];
    return { response: JSON.stringify({ source_image_id:input.source_image_id, source_image_immutable:true, concepts }) };
  }};
  const form=new FormData();
  form.append("externalProcessingConsent","true");
  form.append("image",new Blob([Uint8Array.from([255,216,255,0,1,2])],{type:"image/jpeg"}),"source-kitchen.jpg");
  form.append("roomType","kitchen");form.append("stylePreference","designer-led");form.append("userBrief","A functional family kitchen with a strong architectural focal point.");form.append("intendedUse","daily family cooking");
  form.append("fixed","existing window and room shell");form.append("preserve","existing window and room shell");form.append("replaceable","cabinet fronts and worktops");
  const response=await worker.fetch(sameOriginRequest("/api/concepts",{method:"POST",body:form}),{AI,DB:db});
  const body=await response.json();
  assert.equal(response.status,200);assert.equal(body.concepts.length,3);assert.equal(body.source_image_immutable,true);assert.equal(body.rendering_performed,false);assert.ok(body.session_id);assert.equal(calls.length,2);assert.match(calls[0],/moondream/);assert.match(calls[1],/llama-3.3-70b/);assert.equal(sessions.size,1);
  const saved=JSON.parse([...sessions.values()][0].concepts_json);assert.equal(saved.length,3);assert.ok(saved.every(x=>typeof x.render_instructions==="string"));assert.ok(body.concepts.every(x=>!Object.hasOwn(x,"render_instructions")));
});

test("does not render an image without explicit processing consent", async () => {
  const form = new FormData();
  form.append("externalProcessingConsent", "false");
  const response = await worker.fetch(sameOriginRequest("/api/render", { method: "POST", body: form }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "EXTERNAL_PROCESSING_CONSENT_REQUIRED");
});

test("rejects an unknown room type before invoking vision", async () => {
  const form = new FormData();
  form.append("externalProcessingConsent", "true");
  form.append("image", new Blob([Uint8Array.from([255,216,255,0])], { type: "image/jpeg" }), "room.jpg");
  form.append("roomType", "spaceship");
  const response = await worker.fetch(sameOriginRequest("/api/concepts", { method: "POST", body: form }), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_ROOM_TYPE");
});

test("blocks rendering when the design session belongs to another source photo", async () => {
  let aiCalls=0;
  const DB={prepare(sql){return {bind(){return this;},async first(){return {source_image_id:"sha256:another-photo",room_type:"kitchen",concepts_json:"[]",expires_at:new Date(Date.now()+3600000).toISOString()};},async run(){return {meta:{changes:0}};}};}};
  const form=new FormData();
  form.append("image",new Blob([Uint8Array.from([255,216,255,0,1])],{type:"image/jpeg"}),"source.jpg");
  form.append("requestId","11111111-1111-4111-8111-111111111111");
  form.append("externalProcessingConsent","true");
  form.append("roomType","kitchen");form.append("imageWidth","512");form.append("imageHeight","340");
  form.append("designSessionId","22222222-2222-4222-8222-222222222222");form.append("sourceImageId","sha256:client-photo");form.append("conceptId","architectural-clarity");
  const response=await worker.fetch(sameOriginRequest("/api/render",{method:"POST",body:form}),{DB,AI:{async run(){aiCalls++;throw new Error("must not run");}}});
  assert.equal(response.status,409);assert.equal((await response.json()).error,"DESIGN_SESSION_MISMATCH");assert.equal(aiCalls,0);
});

test("the delivered app client script is syntactically valid", () => {
  const match = APP_HTML.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, "App shell must contain its client application script.");
  assert.doesNotThrow(() => new Function(match[1]));
});

test("does not ask for a Hugging Face token and discloses the Cloudflare free-tier cap", async () => {
  const response = await worker.fetch(new Request("https://nexora.test/"), {});
  const html = await response.text();
  assert.doesNotMatch(html, /hfToken|X-HF-Token|Hugging Face/);
  assert.match(html, /Cloudflare Workers AI/);
  assert.match(html, /Llama 3.3 70B/);
  assert.match(html, /Moondream/);
  assert.match(html, /3 генерации в сутки/);
  assert.match(html, /платные сервисы не подключаются|платный резервный сервис отключён/i);
});
