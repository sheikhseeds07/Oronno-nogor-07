import { logger } from "@/lib/logger";
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
      // One boolean-only SECURITY DEFINER RPC checks IP, account and linked-device
      // blocks without exposing customer_devices/customer_profiles to anon callers.
      const { data: blocked, error } = await db.rpc("get_site_block_status", {
        p_ip: requestIp,
        p_device_id: deviceId,
        p_customer_id: customerId,
      });
      if (error) throw error;
      return { blocked: blocked === true };
    } catch (err) {
      logger.error("[getSiteBlockStatus] check failed:", (err as Error).message);
      return { blocked: false };
    }
  });
