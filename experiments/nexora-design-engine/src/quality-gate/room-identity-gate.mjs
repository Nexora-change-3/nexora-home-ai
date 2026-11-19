const MODEL_ID = "@cf/moondream/moondream3.1-9B-A2B";
const ROOM_TYPES = new Set(["kitchen","living_room","bedroom","bathroom","hallway","office","studio","other"]);
function fail(code,message){const e=new Error(message);e.code=code;return e;}
function toBase64(bytes){let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary);}
function parseAnswer(response){const value=response?.answer??response?.result?.answer??response; if(value&&typeof value==="object"&&!Array.isArray(value))return value; if(typeof value!=="string")throw fail("ROOM_QA_UNCERTAIN","Vision model returned no room classification."); const cleaned=value.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,""); try{return JSON.parse(cleaned);}catch{throw fail("ROOM_QA_UNCERTAIN","Vision model returned an invalid room classification.");}}
function validateImage(image,label){if(!image||!(image.bytes instanceof Uint8Array)||!image.bytes.length||!/^image\/(jpeg|png|webp)$/.test(image.contentType||""))throw fail("ROOM_QA_SOURCE_REQUIRED",`${label} image is unavailable for quality validation.`);}
export async function verifyRoomIdentity({AI,sourceImage,candidateImage,expectedRoomType,modelId=MODEL_ID}={}){
 if(!AI||typeof AI.run!=="function")throw fail("ROOM_QA_UNAVAILABLE","Automatic room-identity validation is unavailable; the generated image was not accepted.");
 validateImage(sourceImage,"Source");validateImage(candidateImage,"Generated");
 if(!ROOM_TYPES.has(expectedRoomType))throw fail("ROOM_QA_INVALID_EXPECTATION","Expected room type is invalid.");
 const question='Identify the primary room shown in this image. Return ONLY JSON with keys room_type and confidence. room_type must be exactly one of: kitchen, living_room, bedroom, bathroom, hallway, office, studio, other. confidence must be a number from 0 to 1. Classify the visible scene, not the requested design. If this is not clearly an interior room, use other. Do not infer from text.';
 async function classify(image){const dataUri=`data:${image.contentType};base64,${toBase64(image.bytes)}`;const response=await AI.run(modelId,{task:"query",image:dataUri,question,reasoning:true,temperature:0,max_tokens:256,stream:false});const answer=parseAnswer(response);if(!ROOM_TYPES.has(answer.room_type)||!Number.isFinite(answer.confidence)||answer.confidence<0||answer.confidence>1)throw fail("ROOM_QA_UNCERTAIN","Vision model could not confidently classify the room.");return {room_type:answer.room_type,confidence:answer.confidence};}
 const source=await classify(sourceImage);const candidate=await classify(candidateImage);
 if(source.confidence<0.6||candidate.confidence<0.6)throw fail("ROOM_QA_UNCERTAIN","Room identity is uncertain; the result was not accepted.");
 if(expectedRoomType!=="other"&&source.room_type!==expectedRoomType)throw fail("SOURCE_ROOM_TYPE_MISMATCH","The selected room type does not match the uploaded photograph. Check the room type before generating.");
 if(candidate.room_type!==source.room_type)throw fail("ROOM_IDENTITY_MISMATCH","The generated image changed the type of room. This result was rejected and the original photograph remains unchanged.");
 return Object.freeze({accepted:true,source_room_type:source.room_type,candidate_room_type:candidate.room_type,source_confidence:source.confidence,candidate_confidence:candidate.confidence,model_id:modelId,checked_at:new Date().toISOString()});
}
