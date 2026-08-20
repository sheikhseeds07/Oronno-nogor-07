import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const InputSchema = z.object({ id: z.string().uuid() });
type Input = z.infer<typeof InputSchema>;

type PublicOrder = {
  id: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  thana: string | null;
  district: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  order_items: Array<{ id: string; product_name: string; quantity: number; price: number; subtotal: number }>;
};

// Confirmation-page data is exposed only through a narrow SECURITY DEFINER RPC.
// The RPC masks the phone and returns no street address, while the UUID acts as
// the customer's unguessable confirmation token.
export const getPublicOrder = createServerFn({ method: "GET" })
  .inputValidator((input: Input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error } = await (supabaseAdmin as any).rpc("get_public_order_confirmation", {
      p_id: (data as Input).id,
    });
    if (error) throw new Error(error.message);
    if (!order) return null;
    return {
      ...(order as PublicOrder),
      customer_address: null as string | null,
    };
  });
