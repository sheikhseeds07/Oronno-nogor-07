import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { assertIsStaff } from "@/lib/_admin-guard.server";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const HISTORY_SELECT =
  "id,invoice_no,status,total,created_at,customer_name,customer_phone,customer_address,thana,district,source,order_items(product_name,quantity)";

const PhoneSchema = z.object({ phone: z.string().min(3).max(32) });

function digitsOf(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("880")) return digits.slice(2);
  if (digits.startsWith("88") && digits.length === 13) return digits.slice(2);
  return digits;
}

// Our Record must show every real order for a phone number, no matter which
// employee it is assigned to and no matter the source (web / incomplete /
// manual). Per-employee row level security would hide other staff members'
// orders, so we go through a SECURITY DEFINER database function that returns
// the full, site-wide history for staff callers.
export const getCustomerHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PhoneSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertIsStaff(context.userId);
    const digits = digitsOf(data.phone);
    if (digits.length < 10) return [] as any[];

    const rpc = await (supabaseAdmin as any).rpc("staff_customer_history", {
      _phone: data.phone,
    });
    if (!rpc.error && Array.isArray(rpc.data)) return rpc.data as any[];

    const last9 = digits.slice(-9);
    const variants = Array.from(
      new Set([data.phone.trim(), digits, `88${digits}`, `+88${digits}`].filter(Boolean)),
    );
    const filters = [
      ...variants.map((v) => `customer_phone.eq.${v}`),
      `customer_phone.ilike.%${last9}`,
      `customer_phone.ilike.%${last9}%`,
    ].join(",");

    const { data: rows, error } = await supabaseAdmin
      .from("orders")
      .select(HISTORY_SELECT)
      .or(filters)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) return rows ?? [];

    const { data: fallback } = await supabaseAdmin
      .from("orders")
      .select(HISTORY_SELECT)
      .in("customer_phone", variants)
      .order("created_at", { ascending: false })
      .limit(200);
    return fallback ?? [];
  });
