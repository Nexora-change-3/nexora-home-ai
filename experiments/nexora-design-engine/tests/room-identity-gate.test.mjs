import test from "node:test";
import assert from "node:assert/strict";
import { verifyRoomIdentity } from "../src/quality-gate/room-identity-gate.mjs";
const image=(v)=>({bytes:new Uint8Array([v,2,3]),contentType:"image/jpeg"});
function ai(answers){let i=0;return {run:async(_model,args)=>{assert.equal(args.task,"query");assert.match(args.image,/^data:image\/jpeg;base64,/);return {answer:JSON.stringify(answers[i++])};}};}
test("accepts a result that preserves the source room type",async()=>{const result=await verifyRoomIdentity({AI:ai([{room_type:"kitchen",confidence:.96},{room_type:"kitchen",confidence:.91}]),sourceImage:image(1),candidateImage:image(2),expectedRoomType:"kitchen"});assert.equal(result.accepted,true);assert.equal(result.source_room_type,"kitchen");});
test("rejects an output that changes the room type",async()=>{await assert.rejects(verifyRoomIdentity({AI:ai([{room_type:"kitchen",confidence:.96},{room_type:"living_room",confidence:.92}]),sourceImage:image(1),candidateImage:image(2),expectedRoomType:"kitchen"}),(e)=>e.code==="ROOM_IDENTITY_MISMATCH");});
test("rejects a source photo that does not match the selected room type",async()=>{await assert.rejects(verifyRoomIdentity({AI:ai([{room_type:"other",confidence:.99},{room_type:"kitchen",confidence:.92}]),sourceImage:image(1),candidateImage:image(2),expectedRoomType:"kitchen"}),(e)=>e.code==="SOURCE_ROOM_TYPE_MISMATCH");});
test("fails closed if Workers AI is unavailable",async()=>{await assert.rejects(verifyRoomIdentity({sourceImage:image(1),candidateImage:image(2),expectedRoomType:"kitchen"}),(e)=>e.code==="ROOM_QA_UNAVAILABLE");});
test("fails closed on low confidence",async()=>{await assert.rejects(verifyRoomIdentity({AI:ai([{room_type:"kitchen",confidence:.4},{room_type:"kitchen",confidence:.9}]),sourceImage:image(1),candidateImage:image(2),expectedRoomType:"kitchen"}),(e)=>e.code==="ROOM_QA_UNCERTAIN");});
