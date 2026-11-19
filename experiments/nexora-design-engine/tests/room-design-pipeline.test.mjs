import test from "node:test";
import assert from "node:assert/strict";
import { buildRoomDesign } from "../src/design-brain/build-room-design.mjs";

const sourceImage = { id:"original-kitchen", contentType:"image/jpeg", bytes:new Uint8Array([1,2,3]) };
const analysis = {
  source_image_id:sourceImage.id,
  observations:[
    {observation_id:"window-1",label:"north window",category:"opening",confidence:.96,visibility:"clear"},
    {observation_id:"cabinet-1",label:"tall cabinet",category:"furniture",confidence:.88,visibility:"partial"},
    {observation_id:"sink-1",label:"sink",category:"appliance",confidence:.91,visibility:"clear"}
  ],
  uncertainties:[{subject:"wall behind cabinet",reason:"Occluded"}],
  dimension_hypotheses:[]
};
const adapter={provider:"mock",modelId:"vision-test",async analyze(){return structuredClone(analysis);}};

test("builds three design briefs from the same immutable source and vision analysis",async()=>{
 const result=await buildRoomDesign({adapter,sourceImage,roomType:"kitchen",stylePreference:"contemporary"});
 assert.equal(result.status,"briefs_ready");
 assert.equal(result.concepts.length,3);
 assert.ok(result.concepts.every(x=>x.input.source_image_id===sourceImage.id && x.input.source_image_immutable));
 assert.equal(result.human_review_required,true);
});

test("vision protects openings but cannot mark furniture or appliances replaceable",async()=>{
 const result=await buildRoomDesign({adapter,sourceImage,roomType:"kitchen"});
 const groups=result.constraint_ledger.constraints;
 assert.equal(groups.preserve.some(x=>x.element==="north window"),true);
 assert.equal(groups.replaceable.length,0);
 assert.equal(groups.unknown.some(x=>x.element==="tall cabinet"),true);
 assert.equal(groups.unknown.some(x=>x.element==="sink"),true);
});

test("explicit user constraints outrank conflicting vision detections",async()=>{
 const result=await buildRoomDesign({
  adapter,sourceImage,roomType:"kitchen",
  constraints:{fixed:[{element:"north window",reason:"Must not be altered."}]}
 });
 const window=result.constraint_ledger.constraints.fixed.find(x=>x.element==="north window");
 assert.ok(window);
 assert.equal(window.source,"user");
 assert.ok(result.constraint_ledger.conflicts.length>0);
});

test("fails when source image or room type is missing",async()=>{
 await assert.rejects(()=>buildRoomDesign({adapter,roomType:"kitchen"}),/original sourceImage/);
 await assert.rejects(()=>buildRoomDesign({adapter,sourceImage}),/roomType is required/);
});

test("does not infer dimensions from image analysis",async()=>{
 const result=await buildRoomDesign({adapter,sourceImage,roomType:"kitchen"});
 assert.equal(result.concepts[0].room.dimensions,undefined);
 assert.ok(result.limitations.some(x=>x.includes("not verified measurements")));
});
