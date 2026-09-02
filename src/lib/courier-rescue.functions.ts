import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

async function assertCourierNotes(userId: string) {
  const [{ data: roles }, { data: perm }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("employee_permissions").select("courier_notes").eq("user_id", userId).maybeSingle(),
  ]);
  const admin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
  if (!admin && !perm?.courier_notes) throw new Error("Courier Notes permission required");
}

const problemPattern = /(not reachable|unreachable|phone.?off|switched off|failed|failure|hold|refused|reject|unavailable|address|location|wrong number|wrong phone|no response|return|delivery attempt|cannot deliver|could not deliver|customer not|cancel)/i;
const cancelPattern = /(cancel|cancellation|refused|reject|won't take|will not take|doesn.?t want|don.?t want)/i;

export const listCourierRescue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCourierNotes(context.userId);
    const { data, error } = await supabaseAdmin.from("orders")
      .select("id,invoice_no,customer_name,customer_phone,customer_address,thana,district,total,status,courier_status,courier_consignment,courier_display_name,created_at")
      .not("courier_consignment", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const { data: states, error: stateError } = await supabaseAdmin.from("courier_rescue_items").select("id,order_id,issue_type,status,assigned_to,employee_note,updated_at");
    if (stateError) throw new Error(stateError.message);
    const stateMap = new Map((states ?? []).map((s: any) => [`${s.order_id}:${s.issue_type}`, s]));
    const rows = (data ?? []).map((o: any) => {
      const raw = String(o.courier_status ?? "").trim();
      const issueType = cancelPattern.test(raw) ? "cancel" : "problem";
      if (!problemPattern.test(raw)) return null;
      const state = stateMap.get(`${o.id}:${issueType}`);
      return { ...o, courier_note: raw || "Courier issue detected", issue_type: issueType, rescue: state ?? { status: "pending", employee_note: "", assigned_to: null } };
    }).filter(Boolean);
    return rows;
  });

export const updateCourierRescue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ order_id: z.string().uuid(), issue_type: z.enum(["problem", "cancel"]), status: z.enum(["pending", "in_progress", "resolved", "cancelled"]), employee_note: z.string().max(2000).optional().default("") }))
  .handler(async ({ data, context }) => {
    await assertCourierNotes(context.userId);
    const { error } = await supabaseAdmin.from("courier_rescue_items").upsert({ order_id: data.order_id, issue_type: data.issue_type, status: data.status, assigned_to: context.userId, employee_note: data.employee_note, updated_at: new Date().toISOString() }, { onConflict: "order_id,issue_type" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
