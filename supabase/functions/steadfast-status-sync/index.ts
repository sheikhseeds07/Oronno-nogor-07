import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
type R=Record<string,unknown>;
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const s=(v:unknown)=>String(v??"").trim();
const norm=(v:string)=>v.toLowerCase().trim().replace(/&/g,"and").replace(/[\s-]+/g,"_");
function map(v:string):"delivered"|"partial"|"pending_return"|"returned"|"cancelled"|"shipped"|null{
 const x=norm(v); if(!x)return null;
 if(x==="delivered"||x.includes("delivered_successfully"))return"delivered";
 if(x==="partial"||x.startsWith("partial_")||x.includes("partially_delivered")||x.includes("partially_cancelled"))return"partial";
 if(x==="in_review"||x.includes("in_review")||x.includes("unreview"))return"shipped";
 if(x.includes("cancellation_request")||x.includes("cancel_request")||x.includes("cancellation_pending")||x.includes("cancel_pending")||x.includes("return_pending")||x.includes("return_process")||x==="pending_return")return"pending_return";
 if(x==="returned"||x==="return"||x==="rto"||x.startsWith("return_")||x.startsWith("rto_")||x.includes("reversed_back")||x.includes("return_to_sender")||x.includes("returned_to_sender")||x.includes("return_to_merchant"))return"returned";
 if(x==="cancelled"||x==="canceled"||x.startsWith("cancelled_")||x.startsWith("canceled_"))return"cancelled";
 return"shipped";
}
async function call(c:string,cfg:R){
 const base=s(cfg.base_url)||"https://portal.packzy.com/api/v1",ak=s(cfg.api_key),sk=s(cfg.secret_key);
 if(!ak||!sk)return null;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const r=await fetch(`${base.replace(/\/$/,"")}/status_by_cid/${encodeURIComponent(c)}`,{headers:{"Api-Key":ak,"Secret-Key":sk,"Content-Type":"application/json"},signal:AbortSignal.timeout(2500)});
   if(r.ok){const p=await r.json().catch(()=>null) as R|null; return s(p?.delivery_status??p?.status_text)||null;}
   if(r.status!==408&&r.status!==429&&r.status<500)return null;
  }catch{}
  if(attempt===0)await new Promise(r=>setTimeout(r,150));
 }
 return null;
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const u=Deno.env.get("SUPABASE_URL"),k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!u||!k)return json({error:"Server configuration missing"},500);
 const a=createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}});
 const supplied=req.headers.get("x-courier-sync-secret")??"";
 const{data:sr}=await a.from("system_job_secrets").select("secret").eq("name","steadfast_status_sync").maybeSingle();
 if(!sr?.secret||supplied!==sr.secret)return json({error:"Unauthorized"},401);
 const{data:ints,error:ie}=await a.from("integrations").select("name,config").eq("is_active",true).in("name",["all_api_steadfast","all_api_steadfast_2"]);
 if(ie)return json({error:ie.message},500);
 const cfgs=(ints??[]).map((r:R)=>({name:s(r.name),cfg:(r.config??{}) as R})).filter(x=>s(x.cfg.api_key)&&s(x.cfg.secret_key));
 const byDisplay=new Map(cfgs.map(x=>[s(x.cfg.display_name),x.cfg]));
 const fallbackCfg=cfgs.length===1?cfgs[0].cfg:null;
 const{data:orders,error}=await a.from("orders").select("id,status,courier_consignment,courier_display_name,courier_status,courier_synced_at").not("courier_consignment","is",null).order("courier_synced_at",{ascending:true,nullsFirst:true}).limit(200);
 if(error)return json({error:error.message},500);
 let checked=0,updated=0,failed=0,skipped=0;
 for(let i=0;i<orders.length;i+=50){
  const rs=await Promise.all(orders.slice(i,i+50).map(async(o)=>{
   let cfg=byDisplay.get(s(o.courier_display_name));
   let cs:string|null=null;
   if(cfg) cs=await call(s(o.courier_consignment),cfg);
   else if(!s(o.courier_display_name)){
    // Historical orders without a display name: try each active Steadfast account.
    for(const x of cfgs){ cs=await call(s(o.courier_consignment),x.cfg); if(cs)break; }
   } else { skipped++; return 0; }
   if(!cs){failed++;return 0;}
   const m=map(cs); if(!m){failed++;return 0;}
   const patch:R={courier_status:cs,courier_synced_at:new Date().toISOString()};
   if(m!==s(o.status))patch.status=m;
   // Persist a successful sync timestamp even when the business status is unchanged.
   // This keeps the reconciliation queue aware that this order was actually checked.
   if(s(o.courier_status)!==cs||m!==s(o.status))patch.updated_at=new Date().toISOString();
   const{error:e}=await a.from("orders").update(patch).eq("id",o.id);
   if(e){failed++;return 0;}
   updated++;
   return 1;
  }));
  checked+=rs.length;
 }
 return json({status:"success",selected:orders.length,checked,updated,failed,skipped});
});