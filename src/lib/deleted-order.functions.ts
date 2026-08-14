import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const ORDER_STATUSES = [
  "web_pending",
  "pending",
  "rts",
  "shipped",
  "delivered",
  "pending_return",
  "returned",
  "partial",
  "cancelled",
  "hold",
] as const;

const RestoreSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
});

const IdSchema = z.object({ id: z.string().uuid() });

async function getOrderAccess(userId: string) {
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) throw new Error(rolesError.message);

  const roleNames = new Set((roles ?? []).map((r) => r.role));
  const isAdmin = roleNames.has("super_admin") || roleNames.has("admin");
  if (isAdmin) return { canManage: true, canPermanentDelete: true };

  const { data: perms, error: permsError } = await supabaseAdmin
    .from("employee_permissions")
    .select("orders")
    .eq("user_id", userId)
    .maybeSingle();
  if (permsError) throw new Error(permsError.message);

  if (!perms?.orders) throw new Error("Unauthorized");
  return { canManage: true, canPermanentDelete: false };
}

export const listDeletedOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await getOrderAccess(context.userId);
    const { data, error } = await (supabaseAdmin as any)
      .from("deleted_orders")
      .select("id,invoice_no,original_status,customer_name,customer_phone,total,original_created_at,deleted_at,items")
      .order("deleted_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return {
      rows: data ?? [],
      canPermanentDelete: access.canPermanentDelete,
    };
  });

export const restoreDeletedOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RestoreSchema.parse(input))
  .handler(async ({ data, context }) => {
    await getOrderAccess(context.userId);
    const { data: restored, error } = await (supabaseAdmin as any).rpc("restore_deleted_order", {
      p_id: data.id,
      p_status: data.status,
    });
    if (error) throw new Error(error.message);
    if (!restored) throw new Error("অর্ডার রিস্টোর করা যায়নি");
    return { ok: true, id: data.id, status: data.status };
  });

export const permanentlyDeleteArchivedOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const access = await getOrderAccess(context.userId);
    if (!access.canPermanentDelete) throw new Error("শুধু অ্যাডমিন পার্মানেন্ট ডিলিট করতে পারবেন");

    const { data: removed, error } = await (supabaseAdmin as any).rpc("permanently_delete_archived_order", {
      p_id: data.id,
    });
    if (error) throw new Error(error.message);
    if (!removed) throw new Error("ডিলিটেড অর্ডার পাওয়া যায়নি");
    return { ok: true, id: data.id };
  });