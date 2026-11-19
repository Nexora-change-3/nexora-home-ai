import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRoomPhoto } from "../src/vision/analyze-room-photo.mjs";
const sourceImage={id:"user-original-kitchen-001",contentType:"image/jpeg",bytes:new Uint8Array([255,216,255,0,1])};
const good={source_image_id:sourceImage.id,observations:[{observation_id:"o1",label:"Window",category:"opening",confidence:.94,visibility:"clear",image_region:{x:.1,y:.2,width:.3,height:.4}}],uncertainties:[{subject:"right wall",reason:"Partially occluded"}],dimension_hypotheses:[{subject:"ceiling height",estimate:2.6,unit:"m",confidence:.31,status:"vision_estimated"}]};
const adapter=(result,inspect)=>({provider:"test-provider",modelId:"test-model",modelVersion:"v1",async analyze(input){inspect?.(input);return result;}});
test("passes a defensive copy of the original and records model provenance",async()=>{
 let received; const out=await analyzeRoomPhoto({adapter:adapter(good,x=>received=x),sourceImage});
 assert.notEqual(received.image.bytes,sourceImage.bytes); assert.deepEqual([...received.image.bytes],[...sourceImage.bytes]);
 assert.equal(out.source_image_id,sourceImage.id); assert.equal(out.model.model_id,"test-model"); assert.equal(out.review_required,true);
});
test("rejects cross-image results",async()=>assert.rejects(()=>analyzeRoomPhoto({adapter:adapter({...good,source_image_id:"other"}),sourceImage}),/does not match/));
test("rejects unsupported categories, confidence and out-of-frame regions",async()=>{
 for(const patch of [{category:"wall-ish"},{confidence:1.4},{image_region:{x:.9,y:.1,width:.3,height:.2}}]){
  const value=structuredClone(good); Object.assign(value.observations[0],patch);
  await assert.rejects(()=>analyzeRoomPhoto({adapter:adapter(value),sourceImage}));
 }
});
test("never upgrades estimated dimensions to verified",async()=>{
 const value=structuredClone(good); value.dimension_hypotheses[0].status="verified";
 await assert.rejects(()=>analyzeRoomPhoto({adapter:adapter(value),sourceImage}),/vision_estimated/);
});
test("requires actual original bytes and supported image type",async()=>{
 await assert.rejects(()=>analyzeRoomPhoto({adapter:adapter(good),sourceImage:{...sourceImage,bytes:new Uint8Array()}}),/original image bytes/);
 await assert.rejects(()=>analyzeRoomPhoto({adapter:adapter(good),sourceImage:{...sourceImage,contentType:"image/gif"}}),/JPEG, PNG, or WebP/);
});
test("requires an adapter and refuses a placeholder source",async()=>{
 await assert.rejects(()=>analyzeRoomPhoto({sourceImage}),/vision adapter/);
 await assert.rejects(()=>analyzeRoomPhoto({adapter:adapter(good),sourceImage:{id:"placeholder",contentType:"image/jpeg"}}),/original image bytes/);
});
