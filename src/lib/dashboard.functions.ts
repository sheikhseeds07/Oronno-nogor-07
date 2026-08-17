import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });
const CONFIRMED = new Set(["pending", "rts", "shipped", "delivered", "pending_return", "returned", "partial"]);
const isConfirmed = (s: unknown) => CONFIRMED.has(String(s));
const isCancelled = (s: unknown) => String(s) === "cancelled";
const isWeb = (o: any) => String(o.source) === "web" && !Boolean(o.originated_from_incomplete);
const bdDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(iso));
const bdHour = (iso: string) => Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date(iso)));
const bdMonth = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));
async function assertStaff(db: SupabaseClient<Database>, userId: string) { const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin", "employee"]); if (error) throw new Error(error.message); if (!data?.length) throw new Error("Unauthorized"); }
export const getPremiumDashboardReport = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => RangeSchema.parse(input)).handler(async ({ data, context }) => {
  const db = context.supabase; await assertStaff(db, context.userId);
  const [ordersR, productsR, customersR, employeesR, landingR] = await Promise.all([
    db.from("orders").select("id,source,status,total,created_at,updated_at,created_by,assigned_to,originated_from_incomplete").gte("created_at", data.from).lte("created_at", data.to).limit(30000),
    db.from("products").select("id,name,stock,is_active").eq("is_active", true).order("stock", { ascending: true }).limit(2000),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("employees").select("id,name,user_id,is_active").eq("is_active", true).order("name"),
    db.from("landing_pages").select("id,title,slug,product_id,is_published").eq("is_published", true),
  ]);
  const visitorsR = await (supabaseAdmin as any).from("site_visitors").select("id,path,landing_page_id,product_id,last_seen").gte("last_seen", new Date(Date.now() - 120000).toISOString()).limit(5000);
  const err = ordersR.error ?? productsR.error ?? customersR.error ?? employeesR.error ?? landingR.error ?? visitorsR.error; if (err) throw new Error(err.message);
  const orders = ordersR.data ?? [], webOrders = orders.filter(isWeb), confirmed = webOrders.filter((o) => isConfirmed(o.status)), processing = webOrders.filter((o) => String(o.status) === "web_pending"), cancelled = webOrders.filter((o) => isCancelled(o.status));
  const confirmedRevenue = confirmed.reduce((n,o)=>n+Number(o.total||0),0), allWebRevenue=webOrders.reduce((n,o)=>n+Number(o.total||0),0);
  const visitorRows=visitorsR.data??[], lpMap=new Map((landingR.data??[]).map(x=>[x.id,x])), productMap=new Map((productsR.data??[]).map(x=>[x.id,x])), liveLanding=new Map<string,number>(), liveProduct=new Map<string,number>();
  for(const v of visitorRows){if(v.landing_page_id)liveLanding.set(v.landing_page_id,(liveLanding.get(v.landing_page_id)??0)+1);if(v.product_id)liveProduct.set(v.product_id,(liveProduct.get(v.product_id)??0)+1)}
  const liveLandingPages=Array.from(liveLanding.entries()).map(([id,visitors])=>({...((lpMap.get(id)??{id,title:"Unknown",slug:""}) as any),visitors})).sort((a,b)=>b.visitors-a.visitors);
  const liveProducts=Array.from(liveProduct.entries()).map(([id,visitors])=>({...((productMap.get(id)??{id,name:"Unknown",stock:0}) as any),visitors})).sort((a,b)=>b.visitors-a.visitors);
  const sourceMap=new Map<string,{source:string;count:number;revenue:number}>(); for(const o of orders){const source=Boolean(o.originated_from_incomplete)?"incomplete":String(o.source||"unknown").toLowerCase()==="web"?"web":"manual";const row=sourceMap.get(source)??{source,count:0,revenue:0};row.count++;row.revenue+=Number(o.total||0);sourceMap.set(source,row)}
  const dayMap=new Map<string,{day:string;created:number;processing:number;confirmed:number;cancelled:number}>(); for(const o of webOrders){const key=bdDay(o.created_at),row=dayMap.get(key)??{day:key,created:0,processing:0,confirmed:0,cancelled:0};row.created++;if(String(o.status)==="web_pending")row.processing++;if(isConfirmed(o.status))row.confirmed++;if(isCancelled(o.status))row.cancelled++;dayMap.set(key,row)}
  const hourly=Array.from({length:24},(_,hour)=>({hour,label:`${hour===0?12:hour>12?hour-12:hour}${hour<12?"AM":"PM"}`,orders:0})); for(const o of webOrders)hourly[bdHour(o.created_at)].orders++;
  const earnings=new Map<string,{month:string;orders:number;revenue:number;confirmed:number}>(); for(const o of webOrders){const key=bdMonth(o.created_at),row=earnings.get(key)??{month:key,orders:0,revenue:0,confirmed:0};row.orders++;row.revenue+=Number(o.total||0);if(isConfirmed(o.status))row.confirmed++;earnings.set(key,row)}
  let bestSelling:Array<any>=[]; const ids=orders.map(o=>o.id); if(ids.length){const itemsR=await db.from("order_items").select("order_id,product_id,product_name,quantity,subtotal").in("order_id",ids).limit(50000);if(itemsR.error)throw new Error(itemsR.error.message);const confirmedIds=new Set(confirmed.map(o=>o.id)),map=new Map<string,{product_id:string|null;name:string;units:number;revenue:number}>();for(const i of itemsR.data??[]){if(!confirmedIds.has(i.order_id))continue;const key=i.product_id??i.product_name,row=map.get(key)??{product_id:i.product_id,name:i.product_name,units:0,revenue:0};row.units+=Number(i.quantity||0);row.revenue+=Number(i.subtotal||0);map.set(key,row)}bestSelling=Array.from(map.values()).sort((a,b)=>b.units-a.units).slice(0,10).map(x=>({...x,landingPages:(landingR.data??[]).filter(lp=>lp.product_id===x.product_id).map(lp=>({title:lp.title,slug:lp.slug}))}))}
  const lowStock=(productsR.data??[]).filter(p=>(p.stock??0)<=5).slice(0,10).map(p=>({id:p.id,name:p.name,stock:p.stock??0})); const stockSummary={total:(productsR.data??[]).length,low:(productsR.data??[]).filter(p=>(p.stock??0)>0&&(p.stock??0)<=5).length,out:(productsR.data??[]).filter(p=>(p.stock??0)<=0).length);
  const employeeMap=new Map<string,{user_id:string|null;name:string;confirmed:number;cancelled:number;total:number}>();for(const e of employeesR.data??[])employeeMap.set(String(e.user_id||e.id),{user_id:e.user_id,name:e.name,confirmed:0,cancelled:0,total:0});for(const o of orders){const key=String(o.created_by||""),e=employeeMap.get(key);if(!e)continue;if(isConfirmed(o.status)){e.confirmed++;e.total++}else if(isCancelled(o.status))e.cancelled++}const employeePerformance=Array.from(employeeMap.values()).sort((a,b)=>b.confirmed-a.confirmed);
  return {real:{created:webOrders.length,total:webOrders.length,processing:processing.length,approved:confirmed.length,pending:processing.length,cancelled:cancelled.length,revenue:confirmedRevenue,allRevenue:allWebRevenue},sourceBreakdown:Array.from(sourceMap.values()).sort((a,b)=>b.count-a.count),daily:Array.from(dayMap.values()).sort((a,b)=>a.day.localeCompare(b.day)),hourly,earnings:Array.from(earnings.values()),bestSelling,lowStock,stockSummary,customers:customersR.count??0,products:(productsR.data??[]).length,liveVisitors:visitorRows.length,liveLandingPages,liveProducts,employeePerformance,incomplete:orders.filter(o=>Boolean(o.originated_from_incomplete)).length};
});
