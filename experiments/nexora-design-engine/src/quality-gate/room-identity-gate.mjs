const MODEL_ID = "@cf/moondream/moondream3.1-9B-A2B";
const ROOM_TYPES = new Set(["kitchen","living_room","bedroom","bathroom","hallway","office","studio","other"]);
function fail(code,message){const e=new Error(message);e.code=code;return e;}
function toBase64(bytes){let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary);}
function parseRoomType(response){
 const value=response?.answer??response?.result?.answer??response?.reasoning?.text??response?.result?.reasoning?.text??response;
 if(value&&typeof value==="object"&&!Array.isArray(value)&&ROOM_TYPES.has(value.room_type))return value.room_type;
 if(typeof value!=="string")throw fail("ROOM_QA_UNCERTAIN","Vision model returned no room classification.");
 const cleaned=value.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
 try{const parsed=JSON.parse(cleaned);if(ROOM_TYPES.has(parsed.room_type))return parsed.room_type;}catch{}
 const text=cleaned.toLowerCase().replace(/[-_]/g," ");
 const patterns=[["living_room",/\bliving\s+room\b/],["kitchen",/\bkitchen\b/],["bedroom",/\bbedroom\b/],["bathroom",/\bbathroom\b/],["hallway",/\bhallway\b|\bcorridor\b/],["office",/\boffice\b/],["studio",/\bstudio\b/],["other",/\bother\b|\bnot an? (?:interior )?room\b|\bno room\b/]];
 const matches=patterns.filter(([,pattern])=>pattern.test(text)).map(([type])=>type);
 if(matches.length!==1)throw fail("ROOM_QA_UNCERTAIN","Vision model could not classify the room unambiguously.");
 return matches[0];
}
function validateImage(image,label){if(!image||!(image.bytes instanceof Uint8Array)||!image.bytes.length||!/^image\/(jpeg|png|webp)$/.test(image.contentType||""))throw fail("ROOM_QA_SOURCE_REQUIRED",`${label} image is unavailable for quality validation.`);}
export async function verifyRoomIdentity({AI,sourceImage,candidateImage,expectedRoomType,modelId=MODEL_ID}={}){
 if(!AI||typeof AI.run!=="function")throw fail("ROOM_QA_UNAVAILABLE","Automatic room-identity validation is unavailable; the generated image was not accepted.");
 validateImage(sourceImage,"Source");validateImage(candidateImage,"Generated");
 if(!ROOM_TYPES.has(expectedRoomType))throw fail("ROOM_QA_INVALID_EXPECTATION","Expected room type is invalid.");
 const question='Identify the primary room shown in this image. Reply with exactly one room label and no other words: kitchen, living_room, bedroom, bathroom, hallway, office, studio, or other. Classify the visible scene, not the requested design. If this is not clearly an interior room, use other. Do not infer from text.';
 async function classify(image){const dataUri=`data:${image.contentType};base64,${toBase64(image.bytes)}`;const response=await AI.run(modelId,{task:"query",image:dataUri,question,reasoning:true,temperature:0,max_tokens:256,stream:false});const roomType=parseRoomType(response);return {room_type:roomType};}
 const source=await classify(sourceImage);const candidate=await classify(candidateImage);
 
 if(expectedRoomType!=="other"&&source.room_type!==expectedRoomType)throw fail("SOURCE_ROOM_TYPE_MISMATCH","The selected room type does not match the uploaded photograph. Check the room type before generating.");
 if(candidate.room_type!==source.room_type)throw fail("ROOM_IDENTITY_MISMATCH","The generated image changed the type of room. This result was rejected and the original photograph remains unchanged.");
 return Object.freeze({accepted:true,source_room_type:source.room_type,candidate_room_type:candidate.room_type,model_id:modelId,checked_at:new Date().toISOString()});
}
