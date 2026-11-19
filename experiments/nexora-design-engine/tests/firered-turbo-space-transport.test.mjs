import test from "node:test";
import assert from "node:assert/strict";
import { createFireRedTurboSpaceTransport, DEFAULT_SPACE_ORIGIN } from "../model-adapters/firered-turbo-space-transport.mjs";
const PNG = new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
const EVENT = "event_12345678";
function completionSse(output) { return `event: complete\ndata: ${JSON.stringify(output)}\n\n`; }

test("submits a data URL through the documented Gradio named endpoint", async () => {
  const calls=[];
  const transport=createFireRedTurboSpaceTransport({fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({event_id:EVENT}),{status:200,headers:{"content-type":"application/json"}});}});
  const result=await transport.submit({imageBytes:new Uint8Array([65,66,67]),mimeType:"image/jpeg",prompt:"A clear interior design prompt",seed:7});
  assert.deepEqual(result,{event_id:EVENT});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,DEFAULT_SPACE_ORIGIN+"/gradio_api/call/infer");
  assert.equal(calls[0].init.redirect,"manual");
  const payload=JSON.parse(calls[0].init.body);
  assert.deepEqual(JSON.parse(payload.data[0]),["data:image/jpeg;base64,QUJD"]);
  assert.equal(payload.data[1],"A clear interior design prompt");
  assert.equal(payload.data[2],7); assert.equal(payload.data[3],false);
  assert.equal(payload.data[4],3); assert.equal(payload.data[5],"fast"); assert.equal(payload.data[6],120);
  assert.equal("fn_index" in payload,false);
});

test("reads the named-endpoint completion event and validates the same-origin PNG output",async()=>{
  const calls=[];
  const transport=createFireRedTurboSpaceTransport({fetchImpl:async(url,init)=>{calls.push({url,init});if(url.endsWith("/"+EVENT))return new Response(completionSse([{path:"/tmp/output.png",url:DEFAULT_SPACE_ORIGIN+"/gradio_api/file=output.png"},42]),{status:200,headers:{"content-type":"text/event-stream"}});if(url.endsWith("/gradio_api/file=output.png"))return new Response(PNG,{status:200,headers:{"content-type":"image/png"}});throw new Error("Unexpected URL "+url);}});
  const result=await transport.getResult({event_id:EVENT});
  assert.equal(result.mimeType,"image/png"); assert.deepEqual([...result.bytes],[...PNG]); assert.equal(result.seed,42);
  assert.equal(calls[0].url,DEFAULT_SPACE_ORIGIN+"/gradio_api/call/infer/"+EVENT);
  assert.equal(calls[0].init.redirect,"manual"); assert.equal(calls[1].init.redirect,"error");
});

test("rejects a foreign output URL before fetching it",async()=>{
  const calls=[];
  const transport=createFireRedTurboSpaceTransport({fetchImpl:async(url)=>{calls.push(url);return new Response(completionSse([{url:"https://evil.example/output.png"},42]),{status:200,headers:{"content-type":"text/event-stream"}});}});
  await assert.rejects(transport.getResult({event_id:EVENT}),(e)=>e.code==="OUTPUT_ORIGIN_REJECTED");
  assert.equal(calls.length,1);
});

test("rejects malformed queue responses and unsupported render configuration",async()=>{
  const malformed=createFireRedTurboSpaceTransport({fetchImpl:async()=>new Response(JSON.stringify({}),{status:200,headers:{"content-type":"application/json"}})});
  await assert.rejects(malformed.submit({imageBytes:new Uint8Array([1]),prompt:"Prompt"}),(e)=>e.code==="QUEUE_OUTCOME_UNKNOWN");
  await assert.rejects(malformed.submit({imageBytes:new Uint8Array([1]),prompt:"Prompt",steps:8}),(e)=>e.code==="UNSUPPORTED_RENDER_CONFIG");
});

test("reports upstream inference failures without leaking details by default",async()=>{
  const transport=createFireRedTurboSpaceTransport({fetchImpl:async()=>new Response("event: error\ndata: internal GPU trace\n\n",{status:200,headers:{"content-type":"text/event-stream"}})});
  await assert.rejects(transport.getResult({event_id:EVENT}),(e)=>e.code==="UPSTREAM_RENDER_FAILED"&&!e.message.includes("internal GPU trace"));
});

test("rejects invalid image bytes even when upstream MIME says PNG",async()=>{
  const transport=createFireRedTurboSpaceTransport({fetchImpl:async(url)=>url.endsWith("/"+EVENT)?new Response(completionSse([{url:DEFAULT_SPACE_ORIGIN+"/gradio_api/file=bad.png"},42]),{status:200,headers:{"content-type":"text/event-stream"}}):new Response(new Uint8Array([1,2,3]),{status:200,headers:{"content-type":"image/png"}})});
  await assert.rejects(transport.getResult({event_id:EVENT}),(e)=>e.code==="INVALID_OUTPUT_IMAGE");
});


test("follows only a same-origin 307 redirect for queue submission", async () => {
  const calls=[];
  const transport=createFireRedTurboSpaceTransport({fetchImpl:async(url,init)=>{calls.push({url,init});if(calls.length===1)return new Response(null,{status:307,headers:{location:"/gradio_api/call/infer/"}});return new Response(JSON.stringify({event_id:EVENT}),{status:200,headers:{"content-type":"application/json"}});}});
  const result=await transport.submit({imageBytes:new Uint8Array([1,2,3]),prompt:"A prompt"});
  assert.deepEqual(result,{event_id:EVENT}); assert.equal(calls.length,2);
  assert.equal(calls[1].url,DEFAULT_SPACE_ORIGIN+"/gradio_api/call/infer/");
  assert.equal(calls[0].init.redirect,"manual"); assert.equal(calls[1].init.redirect,"manual");
});

test("blocks redirects to a different origin before following them", async () => {
  const calls=[];
  const transport=createFireRedTurboSpaceTransport({fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(null,{status:307,headers:{location:"https://evil.example/collect"}});}});
  await assert.rejects(transport.submit({imageBytes:new Uint8Array([1,2,3]),prompt:"A prompt"}),(e)=>e.code==="REDIRECT_ORIGIN_REJECTED");
  assert.equal(calls.length,1);
});
