import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assertPermission } from "@/lib/_admin-guard.server";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const RangeSchema=z.object({from:z.string().datetime(),to:z.string().datetime()});
const CONFIRMED=new Set(["pending","rts","shipped","delivered","pending_return","returned","partial"]);
const isConfirmed=(s:unknown)=>CONFIRMED.has(String(s??"").toLowerCase());
const isCancelled=(s:unknown)=>["cancelled","canceled"].includes(String(s??"").toLowerCase());
const sourceOf=(o:any)=>String(o.source??"").toLowerCase();
const isIncomplete=(o:any)=>sourceOf(o)==="incomplete";
const isRealOrder=(o:any)=>!isIncomplete(o);
const isWebOrder=(o:any)=>isRealOrder(o)&&sourceOf(o)==="web";
const isWebPending=(o:any)=>["web_pending","processing"].includes(String(o.status??"").toLowerCase());
const bdDay=(iso:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka"}).format(new Date(iso));
const bdHour=(iso:string)=>Number(new Intl.DateTimeFormat("en-US",{hour:"2-digit",hour12:false,timeZone:"Asia/Dhaka"}).format(new Date(iso)));
const bdMonth=(iso:string)=>new Intl.DateTimeFormat("en-US",{month:"short",year:"2-digit",timeZone:"Asia/Dhaka"}).format(new Date(iso));
const bdTodayStart=()=>{const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka"}).format(new Date());return new Date(`${day}T00:00:00+06:00`).toISOString()};
const bdTomorrowStart=()=>{const start=new Date(bdTodayStart());start.setUTCDate(start.getUTCDate()+1);return start.toISOString()};
// Keep dashboard live while avoiding repeated heavy downloads from every render.
const DASHBOARD_CACHE_TTL_MS=60_000;
const MAX_DASHBOARD_CACHE_ENTRIES=20;
const dashboardReportCache=new Map<string,{expiresAt:number;value:any}>();
const dashboardInFlight=new Map<string,Promise<any>>();

type MetaProfitConfig={access_token?:string;ad_account_id?:string;account_name?:string;account_id?:string;dollar_rate?:number;courier_cost_per_order?:number;return_rate?:number;cancel_rate?:number};

async function assertStaff(_db:SupabaseClient<Database>,userId:string){await assertPermission(userId,"dashboard");}

async function getMetaProfitData(db:any,from:string,to:string){
 const defaults={dollarRate:122,courierCostPerOrder:50,cancelRate:20,adSpendUsd:0,adSpendBdt:0,connected:false,accountName:""};
 const {data:integration,error}=await db.from("integrations").select("config,is_active").eq("name","meta_ad_account").maybeSingle();
 if(error)throw new Error(error.message);
 const cfg={...defaults,...((integration?.config??{}) as MetaProfitConfig)};
 const dollarRate=Math.max(0,Number(cfg.dollar_rate)||defaults.dollarRate);
 const courierCostPerOrder=Math.max(0,Number(cfg.courier_cost_per_order)||defaults.courierCostPerOrder);
 const cancelRate=Math.min(100,Math.max(0,Number(cfg.cancel_rate ?? cfg.return_rate) || defaults.cancelRate));
 if(!integration?.is_active||!cfg.access_token||!cfg.ad_account_id)return {...defaults,dollarRate,courierCostPerOrder,cancelRate};
 try{
  const accountId=cfg.ad_account_id.replace(/^act_/,"");
  const version="v23.0";
  const base=`https://graph.facebook.com/${version}/act_${encodeURIComponent(accountId)}`;
  const auth=`access_token=${encodeURIComponent(cfg.access_token.trim())}`;
  const since=bdDay(from),until=bdDay(to);
  const timeRange=encodeURIComponent(JSON.stringify({since,until}));
  const url=`${base}/insights?fields=spend&time_range=${timeRange}&level=account&${auth}`;
  const response=await fetch(url);
  const json=await response.json();
  if(!response.ok||json?.error)throw new Error(json?.error?.message||"Meta spend request failed");
  const adSpendUsd=Number(json?.data?.[0]?.spend||0);
  return {dollarRate,courierCostPerOrder,cancelRate,adSpendUsd,adSpendBdt:adSpendUsd*dollarRate,connected:true,accountName:cfg.account_name||"Meta Ad Account"};
 }catch{return {dollarRate,courierCostPerOrder,cancelRate,adSpendUsd:0,adSpendBdt:0,connected:true,accountName:cfg.account_name||"Meta Ad Account",error:"Meta spend unavailable"};}
}

async function fetchOrderItemsByIds(db:any,ids:string[]){
 const rows:any[]=[];
 const chunkSize=200;
 for(let i=0;i<ids.length;i+=chunkSize){
  const chunk=ids.slice(i,i+chunkSize);
  const r=await db.from("order_items").select("order_id,product_id,product_name,quantity,subtotal").in("order_id",chunk).limit(50000);
  if(r.error)throw new Error(r.error.message);
  rows.push(...(r.data??[]));
 }
 return rows;
}

function writeDashboardCache(key:string,value:any){
 const now=Date.now();
 for(const [k,entry] of dashboardReportCache){if(entry.expiresAt<=now)dashboardReportCache.delete(k)}
 while(dashboardReportCache.size>=MAX_DASHBOARD_CACHE_ENTRIES){const first=dashboardReportCache.keys().next().value as string|undefined;if(!first)break;dashboardReportCache.delete(first)}
 dashboardReportCache.set(key,{expiresAt:now+DASHBOARD_CACHE_TTL_MS,value});
}

async function buildDashboardReport(data:any,context:any){
 await assertStaff(context.supabase,context.userId); const db=supabaseAdmin as any;
 const todayStart=bdTodayStart(); const tomorrowStart=bdTomorrowStart();
 const [ordersR,deletedOrdersR,productsR,customersR,employeesR,landingR,todayVisitorsR,activeIncompleteR]=await Promise.all([
  db.from("orders").select("id,source,status,total,created_at,updated_at,created_by,assigned_to,originated_from_incomplete").gte("created_at",data.from).lte("created_at",data.to).limit(30000),
  db.from("deleted_orders").select("id,order_data,original_status,original_created_at").gte("original_created_at",data.from).lte("original_created_at",data.to).limit(30000),
  db.from("products").select("id,name,stock,is_active,cost").order("stock",{ascending:true}).limit(2000),
  db.from("profiles").select("id",{count:"exact",head:true}),
  db.from("employees").select("id,name,user_id,is_active").eq("is_active",true).order("name"),
  db.from("landing_pages").select("id,title,slug,product_id,is_published").eq("is_published",true),
  db.from("site_visitors").select("id",{count:"exact",head:true}).gte("last_seen",todayStart).lt("last_seen",tomorrowStart),
  db.from("incomplete_orders").select("id",{count:"exact",head:true}).gte("updated_at",data.from).lte("updated_at",data.to)
 ]);
 const visitorsR=await db.from("site_visitors").select("id,path,landing_page_id,product_id,last_seen").gte("last_seen",new Date(Date.now()-120000).toISOString()).limit(5000);
 const queryError=ordersR.error??deletedOrdersR.error??productsR.error??customersR.error??employeesR.error??landingR.error??todayVisitorsR.error??activeIncompleteR.error??visitorsR.error;if(queryError)throw new Error(queryError.message);
 const activeOrders=ordersR.data??[];
 const deletedOrders=(deletedOrdersR.data??[]).map((d:any)=>{const archived=(d.order_data??{}) as any;return {...archived,id:d.id,status:archived.status??d.original_status,created_at:archived.created_at??d.original_created_at,updated_at:archived.updated_at??d.original_created_at};});
 const orderMap=new Map<string,any>();
 for(const o of activeOrders) orderMap.set(String(o.id),o);
 for(const o of deletedOrders) if(!orderMap.has(String(o.id))) orderMap.set(String(o.id),o);
 const orders=Array.from(orderMap.values());
 const realOrders=orders.filter(isRealOrder),webOrders=realOrders.filter(isWebOrder),webPendingOrders=webOrders.filter(isWebPending),webConfirmedOrders=webOrders.filter(o=>isConfirmed(o.status)),webCancelledOrders=webOrders.filter(o=>isCancelled(o.status));
 const incompleteSourceOrders=orders.filter(isIncomplete),incompleteProcessing=incompleteSourceOrders.filter(isWebPending),incompleteConfirmed=incompleteSourceOrders.filter(o=>isConfirmed(o.status)),incompleteCancelled=incompleteSourceOrders.filter(o=>isCancelled(o.status));
 const confirmedOrders=realOrders.filter(o=>isConfirmed(o.status));
 const confirmedRevenue=confirmedOrders.reduce((s,o)=>s+Number(o.total||0),0),webRevenue=webOrders.reduce((s,o)=>s+Number(o.total||0),0); const visitorRows=visitorsR.data??[],landingPages=landingR.data??[],products=productsR.data??[];
 const activeProducts=products.filter((p:any)=>p.is_active!==false);
 const profitSettings=await getMetaProfitData(db,data.from,data.to);
 const confirmedOrderIds=confirmedOrders.map((o:any)=>String(o.id));
 const confirmedIds=new Set(confirmedOrderIds);
 // Product cost and best-selling only use confirmed orders, so do not download items for pending/cancelled orders.
 const realOrderIds=confirmedOrderIds;
 const items=realOrderIds.length?await fetchOrderItemsByIds(db,realOrderIds):[];
 let productCost=0;
 if(items.length){
  const costById=new Map(products.map((p:any)=>[String(p.id),Number(p.cost||0)]));
  const costByName=new Map(products.map((p:any)=>[String(p.name||"").trim().toLowerCase(),Number(p.cost||0)]));
  for(const i of items){if(!confirmedIds.has(String(i.order_id)))continue;const cost=i.product_id!=null?costById.get(String(i.product_id)):costByName.get(String(i.product_name||"").trim().toLowerCase());productCost+=Number(i.quantity||0)*Number(cost||0);}
 }
 const courierCost=confirmedOrders.length*profitSettings.courierCostPerOrder;
 const cancellationAdjustment=confirmedRevenue*(profitSettings.cancelRate/100);
 const netProfit=confirmedRevenue-productCost-profitSettings.adSpendBdt-courierCost-cancellationAdjustment;
 const netProfitMargin=confirmedRevenue>0?(netProfit/confirmedRevenue)*100:0;
 const landingMap=new Map(landingPages.map(p=>[p.id,p])),productMap=new Map(activeProducts.map(p=>[p.id,p])),liveLandingCount=new Map<string,number>(),liveProductCount=new Map<string,number>();for(const v of visitorRows){if(v.landing_page_id)liveLandingCount.set(v.landing_page_id,(liveLandingCount.get(v.landing_page_id)??0)+1);if(v.product_id)liveProductCount.set(v.product_id,(liveProductCount.get(v.product_id)??0)+1)}
 const liveLandingPages=Array.from(liveLandingCount.entries()).map(([id,visitors])=>({...((landingMap.get(id)??{id,title:"Unknown",slug:""}) as any),visitors})).sort((a,b)=>b.visitors-a.visitors),liveProducts=Array.from(liveProductCount.entries()).map(([id,visitors])=>({...((productMap.get(id)??{id,name:"Unknown",stock:0}) as any),visitors})).sort((a,b)=>b.visitors-a.visitors);
 const sourceMap=new Map<string,{source:string;count:number;revenue:number}>();for(const o of orders){const source=sourceOf(o)||"unknown",e=sourceMap.get(source)??{source,count:0,revenue:0};e.count++;e.revenue+=Number(o.total||0);sourceMap.set(source,e)}
 const dayMap=new Map<string,{day:string;created:number;processing:number;confirmed:number;cancelled:number}>();for(const o of webOrders){const day=bdDay(o.created_at),e=dayMap.get(day)??{day,created:0,processing:0,confirmed:0,cancelled:0};e.created++;if(isWebPending(o.status))e.processing++;if(isConfirmed(o.status))e.confirmed++;if(isCancelled(o.status))e.cancelled++;dayMap.set(day,e)}
 const hourly=Array.from({length:24},(_,hour)=>({hour,label:`${hour===0?12:hour>12?hour-12:hour}${hour<12?"AM":"PM"}`,orders:0}));for(const o of webOrders){const h=bdHour(o.created_at);if(h>=0&&h<24)hourly[h].orders++}
 const earningsMap=new Map<string,{month:string;orders:number;revenue:number;confirmed:number}>();for(const o of webOrders){const month=bdMonth(o.created_at),e=earningsMap.get(month)??{month,orders:0,revenue:0,confirmed:0};e.orders++;e.revenue+=Number(o.total||0);if(isConfirmed(o.status))e.confirmed++;earningsMap.set(month,e)}
 let bestSelling:any[]=[];if(items.length){const sales=new Map<string,{product_id:string|null;name:string;units:number;revenue:number}>();for(const i of items){if(!confirmedIds.has(String(i.order_id)))continue;const key=i.product_id??i.product_name,e=sales.get(key)??{product_id:i.product_id,name:i.product_name,units:0,revenue:0};e.units+=Number(i.quantity||0);e.revenue+=Number(i.subtotal||0);sales.set(key,e)}bestSelling=Array.from(sales.values()).sort((a,b)=>b.units-a.units).slice(0,10).map(x=>({...x,landingPages:landingPages.filter(p=>p.product_id===x.product_id).map(p=>({title:p.title,slug:p.slug}))}))}
 const lowStock=activeProducts.filter(p=>(p.stock??0)<=5).slice(0,10).map(p=>({id:p.id,name:p.name,stock:p.stock??0})),stockSummary={total:activeProducts.length,low:activeProducts.filter(p=>(p.stock??0)>0&&(p.stock??0)<=5).length,out:activeProducts.filter(p=>(p.stock??0)<=0).length};
 const employeeMap=new Map<string,{user_id:string|null;name:string;confirmed:number;cancelled:number;total:number}>();for(const e of employeesR.data??[])employeeMap.set(String(e.user_id||e.id),{user_id:e.user_id,name:e.name,confirmed:0,cancelled:0,total:0});
 for(const o of orders){const cancelActor=isCancelled(o.status)?String(o.assigned_to||""):"";const cancelEmployee=employeeMap.get(cancelActor);if(isCancelled(o.status)&&cancelEmployee)cancelEmployee.cancelled++;const confirmActor=String(o.created_by||"");const confirmEmployee=employeeMap.get(confirmActor);if(isConfirmed(o.status)&&confirmEmployee){confirmEmployee.confirmed++;confirmEmployee.total++;}}
 const webOrderTotal=webOrders.length;
 const report={real:{created:webOrderTotal,total:webOrderTotal,processing:webPendingOrders.length,approved:webConfirmedOrders.length,pending:webPendingOrders.length,cancelled:webCancelledOrders.length,revenue:confirmedRevenue,allRevenue:webRevenue},webOrders:{total:webOrderTotal,confirmed:webConfirmedOrders.length,processing:webPendingOrders.length,cancelled:webCancelledOrders.length},incompleteOrders:{total:incompleteSourceOrders.length,confirmed:incompleteConfirmed.length,processing:incompleteProcessing.length,cancelled:incompleteCancelled.length,active:activeIncompleteR.count??0},profit:{grossSales:confirmedRevenue,productCost,adSpendUsd:profitSettings.adSpendUsd,adSpendBdt:profitSettings.adSpendBdt,dollarRate:profitSettings.dollarRate,confirmedOrders:confirmedOrders.length,courierCost,courierCostPerOrder:profitSettings.courierCostPerOrder,cancelRate:profitSettings.cancelRate,cancellationAdjustment,netProfit,netProfitMargin,connected:profitSettings.connected,accountName:profitSettings.accountName,error:profitSettings.error??null},sourceBreakdown:Array.from(sourceMap.values()).sort((a,b)=>b.count-a.count),daily:Array.from(dayMap.values()).sort((a,b)=>a.day.localeCompare(b.day)),hourly,earnings:Array.from(earningsMap.values()),bestSelling,lowStock,stockSummary,customers:customersR.count??0,products:activeProducts.length,liveVisitors:visitorRows.length,todayVisitors:todayVisitorsR.count??0,liveLandingPages,liveProducts,employeePerformance:Array.from(employeeMap.values()).sort((a,b)=>(b.confirmed+b.cancelled)-(a.confirmed+a.cancelled)),incomplete:activeIncompleteR.count??0};
 writeDashboardCache(`${data.from}|${data.to}`,report);
 return report;
}

export const getPremiumDashboardReport=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(input=>RangeSchema.parse(input)).handler(async({data,context})=>{
 const cacheKey=`${data.from}|${data.to}`;
 const cached=dashboardReportCache.get(cacheKey); if(cached&&cached.expiresAt>Date.now())return cached.value;
 const existing=dashboardInFlight.get(cacheKey); if(existing)return existing;
 const request=buildDashboardReport(data,context);
 dashboardInFlight.set(cacheKey,request);
 try{return await request;}finally{dashboardInFlight.delete(cacheKey)}
});
