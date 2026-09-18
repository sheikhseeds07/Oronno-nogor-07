import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

const GateSchema = z.object({
  deviceId: z.string().min(6).max(80).nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
});

/**
 * Site entry gate: blocked IP, blocked device or blocked customer account.
 * Same rule for everyone — no owner/staff exemption.
 * Returns only a boolean — never any customer data.
 */
export const getSiteBlockStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => GateSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const requestIp = (getRequestIP({ xForwardedFor: true }) ?? "").replace("::ffff:", "").trim() || null;
    const deviceId = data.deviceId ?? null;
    const customerId = data.customerId ?? null;

    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const db = supabaseAdmin as any;

    try {
      // IP block: a blocked IP cannot open the site at all.
      // Uses the security-definer RPC so the check works without table read access.
      if (requestIp) {
        const { data: blocked } = await db.rpc("is_blocked_visitor", { p_ip: requestIp, p_phone: undefined });
        if (blocked === true) return { blocked: true };
      }

      // Remember this device for the logged-in customer so a block also stops the device.
      if (deviceId && customerId) {
        await db.from("customer_devices").upsert(
          { customer_id: customerId, device_id: deviceId, last_seen_at: new Date().toISOString() },
          { onConflict: "customer_id,device_id" },
        );
      }

      if (customerId) {
        const { data: row } = await db
          .from("customer_profiles")
          .select("is_blocked")
          .eq("id", customerId)
          .maybeSingle();
        if (row?.is_blocked) return { blocked: true };
      }

      if (deviceId) {
        const { data: rows } = await db
          .from("customer_devices")
          .select("customer_id")
          .eq("device_id", deviceId)
          .limit(50);
        const ids = (rows ?? []).map((r: any) => r.customer_id).filter(Boolean);
        if (ids.length) {
          const { data: blockedRows } = await db
            .from("customer_profiles")
            .select("id")
            .in("id", ids)
            .eq("is_blocked", true)
            .limit(1);
          if (blockedRows?.length) return { blocked: true };
        }
      }
    } catch (err) {
      console.error("[getSiteBlockStatus] check failed:", (err as Error).message);
    }

    return { blocked: false };
  });
