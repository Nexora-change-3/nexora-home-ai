import test from "node:test";
import assert from "node:assert/strict";
import { createQwen2511FastTransport, DEFAULT_SPACE_ORIGIN } from "../model-adapters/qwen-2511-fast-transport.mjs";
const PNG=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
const PNG_B64=Buffer.from(PNG).toString("base64");
const EVENT="qwen_event_12345678";
const sse=(event,data)=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

test("runs the provider safety check through its named-field endpoint",async()=>{
 const calls=[];const transport=createQwen2511FastTransport({fetchImpl:async(url,init)=>{calls.push({url,init});if(url.endsWith("/gradio_api/call/v2/check_safety"))return new Response(JSON.stringify({event_id:EVENT}),{status:200});return new Response(sse("complete",[{status:"ok",label:"safe",score:1}]),{status:200,headers:{"content-type":"text/event-stream"}});}});
 const result=await transport.checkSafety("A safe interior design prompt");assert.equal(result.status,"ok");assert.equal(calls.length,2);assert.equal(calls[0].url,DEFAULT_SPACE_ORIGIN+"/gradio_api/call/v2/check_safety");assert.deepEqual(JSON.parse(calls[0].init.body),{prompt:"A safe interior design prompt"});assert.equal(calls[1].url,DEFAULT_SPACE_ORIGIN+"/gradio_api/call/check_safety/"+EVENT);
});

test("submits a JPEG data URL with the pinned Qwen Fast parameters",async()=>{
 let request;const transport=createQwen2511FastTransport({authToken:"hf_test_read_token",fetchImpl:async(url,init)=>{request={url,init};return new Response(JSON.stringify({event_id:EVENT}),{status:200});}});
 const result=await transport.submit({imageBytes:new Uint8Array([65,66,67]),mimeType:"image/jpeg",prompt:"Redesign this kitchen",seed:42});assert.deepEqual(result,{event_id:EVENT});assert.equal(request.url,DEFAULT_SPACE_ORIGIN+"/gradio_api/call/v2/edit_image");assert.equal(request.init.headers.authorization,"Bearer hf_test_read_token");assert.equal(request.init.redirect,"manual");const body=JSON.parse(request.init.body);assert.deepEqual(JSON.parse(body.images_b64_json),["data:image/jpeg;base64,QUJD"]);assert.equal(body.prompt,"Redesign this kitchen");assert.equal(body.lora_adapter,"Style-Transfer");assert.equal(body.seed,42);assert.equal(body.randomize_seed,false);assert.equal(body.guidance_scale,1);assert.equal(body.steps,4);
});

test("reads a successful PNG completion from the edit event stream",async()=>{
 const calls=[];const transport=createQwen2511FastTransport({fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(sse("complete",[{image:"data:image/png;base64,"+PNG_B64,seed:73,status:"success"}]),{status:200,headers:{"content-type":"text/event-stream"}});}});
 const result=await transport.getResult({event_id:EVENT});assert.equal(result.mimeType,"image/png");assert.deepEqual([...result.bytes],[...PNG]);assert.equal(result.seed,73);assert.equal(calls[0].url,DEFAULT_SPACE_ORIGIN+"/gradio_api/call/edit_image/"+EVENT);assert.equal(calls[0].init.redirect,"manual");
});

test("maps exhausted public ZeroGPU quota to a stable error code",async()=>{
 const transport=createQwen2511FastTransport({fetchImpl:async()=>new Response(sse("error",{error:"You have exceeded your ZeroGPU runs limit"}),{status:200,headers:{"content-type":"text/event-stream"}})});
 await assert.rejects(transport.getResult({event_id:EVENT}),(e)=>e.code==="ZERO_GPU_QUOTA_EXCEEDED");
});

test("blocks unsafe external redirects before following them",async()=>{
 let calls=0;const transport=createQwen2511FastTransport({fetchImpl:async()=>{calls++;return new Response(null,{status:307,headers:{location:"https://evil.example/collect"}});}});
 await assert.rejects(transport.submit({imageBytes:new Uint8Array([1]),prompt:"A prompt"}),(e)=>e.code==="REDIRECT_ORIGIN_REJECTED");assert.equal(calls,1);
});

test("rejects safety-check results that are not approved",async()=>{
 const transport=createQwen2511FastTransport({fetchImpl:async(url)=>url.endsWith("/gradio_api/call/v2/check_safety")?new Response(JSON.stringify({event_id:EVENT}),{status:200}):new Response(sse("complete",[{status:"blocked",label:"unsafe"}]),{status:200,headers:{"content-type":"text/event-stream"}})});
 await assert.rejects(transport.checkSafety("unsafe prompt"),(e)=>e.code==="PROMPT_REJECTED");
});
