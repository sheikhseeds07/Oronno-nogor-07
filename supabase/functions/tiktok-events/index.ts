import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://oronnonogor.com",
  "https://www.oronnonogor.com",
  "https://sheikhseeds.com",
  "https://www.sheikhseeds.com",
]);
const allowedHosts = new Set(["oronnonogor.com","www.oronnonogor.com","sheikhseeds.com","www.sheikhseeds.com"]);
const allowedEvents = new Set(["PageView","ViewContent","Search","AddToCart","InitiateCheckout","Lead","Contact","Purchase"]);
const rate = new Map<string,{start:number;count:number}>();

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string,string> = {
    "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
    "Vary":"Origin",
  };
  if (allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function reply(req: Request, body: unknown, status=200) {
  return new Response(JSON.stringify(body), {status,headers:{...cors(req),"Content-Type":"application/json","Cache-Control":"no-store"}});
}
function sha256(value:string) {
  return crypto.subtle.digest("SHA-256",new TextEncoder().encode(value.trim().toLowerCase()))
    .then(buf=>Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,"0")).join(""));
}
function normalizePhone(value:string) {
  const digits=value.replace(/\D/g,"");
  return digits.startsWith("880") ? "+"+digits : digits.startsWith("0") ? "+880"+digits.slice(1) : "+"+digits;
}
Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response("ok",{headers:cors(req)});
  const url=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key) return reply(req,{ok:false,error:"server_database_key_missing"},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:row,error:dbError}=await db.from("integrations").select("config,is_active").eq("name","tiktok_pixel").maybeSingle();
  if(dbError) return reply(req,{ok:false,error:"integration_read_failed"},503);
  const config=(row?.config ?? {}) as Record<string,unknown>;
  const enabled=row?.is_active===true;
  const pixelId=typeof config.pixel_id==="string" ? config.pixel_id.trim() : "";
  const accessToken=typeof config.access_token==="string" ? config.access_token.trim() : "";
  const testEventCode=typeof config.test_event_code==="string" ? config.test_event_code.trim() : "";
  const ready=enabled&&!!pixelId&&!!accessToken;

  if(req.method==="GET") {
    if(new URL(req.url).searchParams.get("status")==="1") return reply(req,{
      enabled,pixel_id_present:!!pixelId,access_token_present:!!accessToken,
      test_event_code_present:!!testEventCode,server_events_ready:ready,
    });
    return reply(req,{pixel_id:enabled&&pixelId?pixelId:null,enabled:enabled&&!!pixelId});
  }
  if(req.method!=="POST") return reply(req,{ok:false,error:"method_not_allowed"},405);
  if(!ready) return reply(req,{ok:false,message:"TikTok server configuration is incomplete"},503);

  const origin=req.headers.get("origin")||"";
  if(origin&&!allowedOrigins.has(origin)) return reply(req,{ok:false,error:"origin_not_allowed"},403);
  const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  const now=Date.now(),bucket=rate.get(ip);
  if(bucket&&now-bucket.start<60000&&bucket.count>=40) return reply(req,{ok:false,error:"rate_limited"},429);
  if(!bucket||now-bucket.start>=60000) rate.set(ip,{start:now,count:1}); else bucket.count++;
  if(rate.size>3000) for(const [k,v] of rate) if(now-v.start>60000) rate.delete(k);

  let input:Record<string,unknown>;
  try { input=await req.json(); } catch { return reply(req,{ok:false,error:"invalid_json"},400); }
  const event=typeof input.event==="string"?input.event:"";
  const eventId=typeof input.event_id==="string"?input.event_id:"";
  if(!allowedEvents.has(event)||eventId.length<8||eventId.length>200) return reply(req,{ok:false,error:"invalid_event"},400);
  const sourceUrl=typeof input.event_source_url==="string"?input.event_source_url:null;
  if(sourceUrl) {
    try { if(!allowedHosts.has(new URL(sourceUrl).hostname.toLowerCase())) return reply(req,{ok:false,error:"invalid_source"},400); }
    catch { return reply(req,{ok:false,error:"invalid_source"},400); }
  }
  const properties=(input.properties&&typeof input.properties==="object"&&!Array.isArray(input.properties)?input.properties:{}) as Record<string,unknown>;
  if(event==="Purchase") {
    const orderId=typeof properties.order_id==="string"?properties.order_id:eventId;
    const {data:order,error}=await db.from("orders").select("id,total").eq("id",orderId).maybeSingle();
    if(error||!order) return reply(req,{ok:false,error:"purchase_order_not_found"},404);
    const value=Number(properties.value);
    if(!Number.isFinite(value)||Math.abs(value-Number(order.total))>0.01) return reply(req,{ok:false,error:"purchase_value_mismatch"},400);
  }

  const current=Math.floor(Date.now()/1000);
  const supplied=Number(input.event_time);
  const eventTime=Number.isInteger(supplied)&&supplied<=current+60&&supplied>current-7*86400?supplied:current;
  const user:Record<string,unknown>={};
  const copyString=(key:string,max:number)=>{const v=input[key];if(typeof v==="string"&&v.length)user[key]=v.slice(0,max);};
  copyString("ttclid",1000);copyString("ttp",500);
  const clientIp=typeof input.clientIp==="string"?input.clientIp:(req.headers.get("cf-connecting-ip")||"");
  const userAgent=typeof input.userAgent==="string"?input.userAgent:(req.headers.get("user-agent")||"");
  if(clientIp) user.ip=clientIp;
  if(userAgent) user.user_agent=userAgent;
  if(typeof input.email==="string"&&input.email) user.email=await sha256(input.email);
  if(typeof input.phone==="string"&&input.phone) user.phone=await sha256(normalizePhone(input.phone));
  if(typeof input.externalId==="string"&&input.externalId) user.external_id=await sha256(input.externalId);
  const eventName=event==="Purchase"?"CompletePayment":event==="Lead"?"SubmitForm":event;
  const payload={
    event_source:"web",event_source_id:pixelId,
    data:[{event:eventName,event_id:eventId,event_time:eventTime,...(sourceUrl?{page:{url:sourceUrl}}:{}),user,...(Object.keys(properties).length?{properties}:{})}],
    ...(testEventCode?{test_event_code:testEventCode}:{})
  };
  try {
    const response=await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/",{
      method:"POST",headers:{"Content-Type":"application/json","Access-Token":accessToken},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)
    });
    const result=await response.json().catch(()=>({})) as {code?:number;message?:string};
    if(response.ok&&result.code===0) return reply(req,{ok:true});
    return reply(req,{ok:false,message:result.message||"TikTok Events API rejected the event",code:result.code??null},502);
  } catch {
    return reply(req,{ok:false,message:"TikTok Events API request failed"},502);
  }
});
