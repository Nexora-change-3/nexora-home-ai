import test from "node:test";
import assert from "node:assert/strict";
import { createMoondreamWorkersAIAdapter, MOONDREAM_MODEL_ID } from "../model-adapters/workers-ai-moondream.mjs";
import { analyzeRoomPhoto } from "../src/vision/analyze-room-photo.mjs";

const photo={id:"user-original-room-01",contentType:"image/jpeg",bytes:new Uint8Array([1,2,3,254,255])};
const payload={observations:[{observation_id:"window-1",label:"Window on far wall",category:"opening",confidence:.91,visibility:"clear",image_region:{x:.2,y:.1,width:.4,height:.35}}],uncertainties:[{subject:"left wall corner",reason:"Hidden behind a cabinet"}],dimension_hypotheses:[]};

test("uses the documented Moondream model and passes the original as a data URI",async()=>{
 let call;
 const AI={async run(model,input){call={model,input};return {answer:JSON.stringify(payload)};}};
 const adapter=createMoondreamWorkersAIAdapter({AI});
 const result=await analyzeRoomPhoto({adapter,sourceImage:photo});
 assert.equal(call.model,MOONDREAM_MODEL_ID);
 assert.equal(call.input.task,"query");
 assert.equal(call.input.image,"data:image/jpeg;base64,AQID/v8=");
 assert.match(call.input.question,/Do not estimate room dimensions/);
 assert.equal(result.source_image_id,photo.id);
 assert.equal(result.observations[0].label,"Window on far wall");
 assert.equal(result.model.provider,"cloudflare-workers-ai");
});

test("fails closed when model answer is not valid JSON",async()=>{
 const AI={async run(){return {answer:"The room seems to have a window."};}};
 const adapter=createMoondreamWorkersAIAdapter({AI});
 await assert.rejects(()=>analyzeRoomPhoto({adapter,sourceImage:photo}),/not valid JSON/);
});

test("rejects missing Workers AI binding",()=>{
 assert.throws(()=>createMoondreamWorkersAIAdapter({}),/Workers AI binding/);
});
