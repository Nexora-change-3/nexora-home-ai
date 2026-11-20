import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDesignReference } from "../src/vision/analyze-design-reference.mjs";
import { createMoondreamWorkersAIAdapter } from "../model-adapters/workers-ai-moondream.mjs";

const referenceImage = { id:"reference-1", contentType:"image/jpeg", bytes:new Uint8Array([1,2,3]) };
const valid = {
  reference_image_id:"reference-1",
  design_language:"Quiet sculptural contemporary with warm natural materials",
  principles:{ proportions:["large calm planes"], rhythm:["repeated vertical joinery"], material_hierarchy:["stone focal plane over matte timber"], contrast:["soft tonal contrast"], joinery_language:["integrated handleless fronts"], lighting:["concealed linear layers"], composition:["one dominant focal plane"], color_relationships:["warm neutral palette"] },
  signature_elements:["monolithic stone focal plane"], adaptation_rules:["translate vertical rhythm to available cabinetry"], do_not_copy:["do not copy the reference room layout"], uncertainties:[]
};
const adapter = { provider:"mock-vision", modelId:"reference-test", modelVersion:"test", async analyzeReference(){ return structuredClone(valid); } };

test("extracts structured transferable design principles from a reference image", async () => {
  const result = await analyzeDesignReference({ adapter, referenceImage });
  assert.equal(result.reference_image_id, referenceImage.id);
  assert.equal(result.design_language, valid.design_language);
  assert.deepEqual(result.principles.rhythm, ["repeated vertical joinery"]);
  assert.ok(result.do_not_copy.includes("do not copy the reference room layout"));
});

test("rejects a reference analysis tied to a different image", async () => {
  await assert.rejects(() => analyzeDesignReference({ adapter:{...adapter, async analyzeReference(){return {...structuredClone(valid),reference_image_id:"other"};}}, referenceImage }), /does not match/);
});

test("rejects incomplete reference principles instead of inventing design language", async () => {
  await assert.rejects(() => analyzeDesignReference({ adapter:{...adapter, async analyzeReference(){const x=structuredClone(valid);delete x.principles.lighting;return x;}}, referenceImage }), /principles.lighting/);
});

test("requires a dedicated reference-analysis method", async () => {
  await assert.rejects(() => analyzeDesignReference({ adapter:{provider:"mock",modelId:"x"}, referenceImage }), /analyzeReference/);
});

test("Moondream adapter uses a dedicated design-reference prompt", async () => {
  let sentQuestion = "";
  const moondream = createMoondreamWorkersAIAdapter({ AI:{ async run(_model,args){ sentQuestion=args.question; return {answer:JSON.stringify(valid)}; } } });
  const result = await moondream.analyzeReference({image:{sourceImageId:referenceImage.id,contentType:referenceImage.contentType,bytes:referenceImage.bytes}});
  assert.match(sentQuestion,/visual design reference/);
  assert.match(sentQuestion,/Do NOT infer dimensions/);
  assert.equal(result.reference_image_id,referenceImage.id);
});
