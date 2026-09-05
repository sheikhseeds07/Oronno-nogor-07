import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function toDigits(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

async function bridge(body: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
  const { data, error } = await supabaseAdmin.functions.invoke("phone-otp-bridge", { body });
  if (error) {
    let detail = "";
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) {
        const raw = await ctx.clone().text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { message?: unknown; error?: unknown };
            const d = parsed?.message ?? parsed?.error;
            if (typeof d === "string" && d.trim()) detail = d.trim();
          } catch {
            detail = raw.replace(/\s+/g, " ").trim().slice(0, 300);
          }
        }
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail || error.message || "OTP সার্ভিসে সমস্যা");
  }
  const payload = data as { error?: unknown } | null;
  if (payload?.error) throw new Error(String(payload.error));
  return payload as Record<string, unknown> | null;
}

/** Send a login code to a customer phone number. */
export const customerSendOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().min(6).max(20) }).parse(input))
  .handler(async ({ data }) => {
    await bridge({ action: "send", phone: toDigits(data.phone) });
    return { ok: true as const };
  });

/**
 * Verify the code and hand back a one-time email token the browser can exchange
 * for a real Supabase session (so RLS works for reviews / questions / posts).
 *
 * Account creation is handled by phone-otp-bridge using its service-role client,
 * so the request-scoped publishable-key client never performs Auth Admin calls.
 */
export const customerVerifyOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        phone: z.string().min(6).max(20),
        code: z.string().min(4).max(8),
        fullName: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const phone = toDigits(data.phone);
    const code = data.code.replace(/[^0-9]/g, "");
    const payload = (await bridge({
      action: "verify",
      phone,
      code,
      fullName: data.fullName?.trim() || undefined,
    })) as { verified?: boolean; tokenHash?: string; email?: string } | null;

    if (payload?.verified === false) throw new Error("কোড সঠিক নয়");
    if (!payload?.tokenHash) throw new Error("লগইন টোকেন তৈরি হয়নি");

    return { tokenHash: payload.tokenHash, email: payload.email };
  });
