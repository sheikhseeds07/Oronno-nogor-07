import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const orderSchema = z.object({
  customer_name: z.string().min(2, "নাম কমপক্ষে ২ অক্ষরের হতে হবে"),
  customer_phone: z.string().regex(/^(?:\+88|88)?(01[3-9]\d{8})$/, "সঠিক মোবাইল নাম্বার দিন"),
  customer_address: z.string().min(5, "ঠিকানা বিস্তারিত লিখুন"),
  district: z.string().min(1, "জেলা সিলেক্ট করুন"),
  thana: z.string().optional().nullable(),
  payment_method: z.enum(["cod", "bkash", "nagad"]).default("cod"),
  items: z.array(z.object({
    product_id: z.string().uuid().optional().nullable(),
    product_name: z.string(),
    quantity: z.number().min(1),
    price: z.number().min(0),
    variant_id: z.string().uuid().optional().nullable(),
  })).min(1, "কার্টে কোনো পণ্য নেই"),
  subtotal: z.number(),
  shipping_charge: z.number().optional().nullable(),
  delivery_fee: z.number().optional().nullable(),

  total: z.number(),
  coupon_code: z.string().optional().nullable(),
  discount_amount: z.number().default(0),
  note: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const placeOrder = createServerFn({ method: "POST" })
  .validator(zodValidator(orderSchema))
  .handler(async ({ data }) => {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address,
        district: data.district,
        thana: data.thana,
        payment_method: data.payment_method,
        subtotal: data.subtotal,
        delivery_fee: data.shipping_charge ?? data.delivery_fee ?? 0,
        total: data.total,
        coupon_code: data.coupon_code,
        discount: data.discount_amount,
        notes: data.note || data.notes || null,
        status: "pending",
      } as any)
      .select("id")
      .single();

    if (orderError) throw new Error(orderError.message);

    const orderItems = data.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems as any);
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw new Error(itemsError.message);
    }

    try {
      await supabase.from("incomplete_orders").delete().eq("phone", data.customer_phone);
    } catch { /* ignore cleanup errors */ }

    return { success: true, id: order.id, orderId: order.id };
  });
