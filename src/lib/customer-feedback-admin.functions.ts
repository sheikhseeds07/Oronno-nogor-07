import { logger } from "@/lib/logger";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

async function assertAdmin(db:any,userId:string){const {data,error}=await db.from("user_roles").select("role").eq("user_id",userId).in("role",["admin","super_admin"]).limit(1);if(error)throw new Error(error.message);if(!data?.length)throw new Error("Unauthorized");}
async function adminDb(context:any){await assertAdmin(context.supabase,context.userId);const {supabaseAdmin}=await import("@/lib/personal-supabase/client.server");return supabaseAdmin as any;}

export const listCustomerFeedback=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{const db=await adminDb(context);const safe=async(table:string,cols:string,order=true)=>{let qb=db.from(table).select(cols);if(order)qb=qb.order("created_at",{ascending:false});const {data,error}=await qb.limit(1000);if(error){logger.error(`[customer-feedback] ${table}: ${error.message}`);return [] as any[];}return (data??[]) as any[];};const [reviews,questions,products]=await Promise.all([safe("product_reviews","id,product_id,user_id,author_name,rating,body,image_urls,verified_purchase,status,admin_reply,replied_at,created_at"),safe("product_questions","id,product_id,user_id,author_name,question,answer,answered_at,status,created_at"),safe("products","id,name,slug",false)]);return{reviews,questions,products};});

const Reply=z.object({id:z.string().uuid(),reply:z.string().max(5000).nullable()});
export const replyCustomerReview=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>Reply.parse(i)).handler(async({data,context})=>{const db=await adminDb(context);const patch={admin_reply:data.reply?.trim()||null,replied_at:data.reply?.trim()?new Date().toISOString():null};const {error}=await db.from("product_reviews").update(patch).eq("id",data.id);if(error)throw new Error(error.message);return true;});
export const answerCustomerQuestion=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>Reply.parse(i)).handler(async({data,context})=>{const db=await adminDb(context);const answer=data.reply?.trim()||null;const {error}=await db.from("product_questions").update({answer,answered_at:answer?new Date().toISOString():null}).eq("id",data.id);if(error)throw new Error(error.message);return true;});
const Delete=z.object({id:z.string().uuid()});
export const deleteCustomerReview=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>Delete.parse(i)).handler(async({data,context})=>{const db=await adminDb(context);const {error}=await db.from("product_reviews").delete().eq("id",data.id);if(error)throw new Error(error.message);return true;});
export const deleteCustomerQuestion=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>Delete.parse(i)).handler(async({data,context})=>{const db=await adminDb(context);const {error}=await db.from("product_questions").delete().eq("id",data.id);if(error)throw new Error(error.message);return true;});
