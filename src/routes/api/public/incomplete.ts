import { logger } from "@/lib/logger";
import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

export const Route = createFileRoute("/api/public/incomplete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const phone = String(body?.phone ?? "");
          const ip = getRequestIP({ xForwardedFor: true }) ?? String(body?.ip ?? "");
          const items = Array.isArray(body?.items) ? body.items.slice(0, 50) : [];
          if (!/^01[3-9][0-9]{8}$/.test(phone) || !items.length) {
            return Response.json({ ok: false }, { status: 400 });
          }
          const { data, error } = await supabaseAdmin.rpc("upsert_incomplete_checkout", {
            p_phone: phone,
            p_ip: ip,
            p_customer_name: String(body?.customer_name ?? "").slice(0, 255),
            p_customer_address: String(body?.customer_address ?? "").slice(0, 1000),
            p_delivery_zone: String(body?.delivery_zone ?? "").slice(0, 100),
            p_delivery_fee: Number(body?.delivery_fee ?? 0),
            p_subtotal: Number(body?.subtotal ?? 0),
            p_total: Number(body?.total ?? 0),
            p_note: String(body?.note ?? "").slice(0, 2000),
            p_items: items.map((i: any) => ({
              id: String(i?.id ?? "").slice(0, 64),
              name: String(i?.name ?? "").slice(0, 500),
              price: Number(i?.price ?? 0),
              quantity: Math.max(1, Math.min(1000, Number(i?.quantity ?? 1))),
            })),
          });
          if (error) throw error;
          return Response.json({ ok: true, id: data });
        } catch (error) {
          logger.error("[incomplete] save failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
