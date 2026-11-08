import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://oronnonogor.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const allowedEvents = new Set(["PageView","ViewContent","Search","AddToCart","InitiateCheckout","Lead","Contact","AddToWishlist","CompleteRegistration","Purchase"]);
const allowedHosts = new Set(["oronnonogor.com","www.oronnonogor.com","sheikhseeds.com","www.sheikhseeds.com"]);
const rate = new Map<string, { start: number; count: number }>();

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type":"application/json", "Cache-Control":"no-store" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ ok:false },405);

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now(), bucket = rate.get(ip);
  if (bucket && now - bucket.start < 60_000 && bucket.count >= 40) return response({ ok:false,error:"rate_limited" },429);
  if (!bucket || now - bucket.start >= 60_000) rate.set(ip,{start:now,count:1}); else bucket.count++;

  let body:any;
  try { body=await req.json(); } catch { return response({ok:false,error:"invalid_json"},400); }
  const event=body?.data?.[0];
  if (!Array.isArray(body?.data)||body.data.length!==1||!event||!allowedEvents.has(event.event_name)
    ||typeof event.event_id!=="string"||event.event_id.length<8||event.event_id.length>200||event.action_source!=="website") {
    return response({ok:false,error:"invalid_event"},400);
  }
  if (event.event_source_url) {
    try { if(!allowedHosts.has(new URL(event.event_source_url).hostname.toLowerCase())) return response({ok:false,error:"invalid_source"},400); }
    catch { return response({ok:false,error:"invalid_source"},400); }
  }

  const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key) return response({ok:false,error:"server_not_configured"},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

  if(event.event_name==="Purchase") {
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.event_id)) return response({ok:false,error:"invalid_order_id"},400);
    const {data:order,error}=await db.from("orders").select("id,total").eq("id",event.event_id).maybeSingle();
    if(error||!order) return response({ok:false,error:"order_not_found"},404);
    const value=Number(event.custom_data?.value);
    if(!Number.isFinite(value)||Math.abs(value-Number(order.total))>0.01) return response({ok:false,error:"order_value_mismatch"},400);
  }

  const {data,error}=await db.rpc("dispatch_meta_capi_event",{p_body:body});
  if(!error&&data===true) return response({ok:true});
  if(event.event_name==="Purchase") {
    const {data:queued,error:queueError}=await db.rpc("queue_meta_capi_purchase",{p_event_id:event.event_id,p_body:body});
    if(!queueError&&queued===true) return response({ok:true,queued:true});
  }
  return response({ok:false,error:"dispatch_failed"},503);
});
