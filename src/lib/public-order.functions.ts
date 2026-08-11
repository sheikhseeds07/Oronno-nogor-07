import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const InputSchema = z.object({ id: z.string().uuid() });
type Input = z.infer<typeof InputSchema>;

// Returns a confirmation-page view of an order. Anyone with the order UUID
// (which the customer receives at checkout) can view it. PII is minimised:
// phone is masked to the last 3 digits, and only the city/area is returned
// for address — not the full street address.
export const getPublicOrder = createServerFn({ method: "GET" })
  .inputValidator((input: Input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id,status,customer_name,customer_phone,thana,district,subtotal,delivery_fee,total,created_at, order_items(id,product_name,quantity,price,subtotal)")
      .eq("id", (data as Input).id)
      .maybeSingle();
    if (!order) return null;
    const phone = order.customer_phone ?? "";
    const maskedPhone = phone.length >= 3 ? `${"*".repeat(Math.max(0, phone.length - 3))}${phone.slice(-3)}` : phone;
    return {
      ...order,
      customer_phone: maskedPhone,
      customer_address: null as string | null,
    };
  });
