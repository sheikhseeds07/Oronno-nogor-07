import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function toDigits(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

function emailForPhone(phone: string) {
  return `c${toDigits(phone)}@customer.sheikhseeds.app`;
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
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");

    const code = data.code.replace(/[^0-9]/g, "");
    const payload = (await bridge({ action: "verify", phone: toDigits(data.phone), code })) as
      | { verified?: boolean }
      | null;
    if (payload?.verified === false) throw new Error("কোড সঠিক নয়");

    const phone = toDigits(data.phone);
    const email = emailForPhone(phone);

    // Find or create the auth user behind this phone number.
    const { data: existingProfile } = await (supabaseAdmin as any)
      .from("customer_profiles")
      .select("id, full_name")
      .eq("phone", phone)
      .maybeSingle();

    let userId = existingProfile?.id as string | undefined;

    if (!userId) {
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { phone, full_name: data.fullName ?? null, customer: true },
      });
      if (created.error && !/already/i.test(created.error.message)) {
        throw new Error(created.error.message);
      }
      userId = created.data?.user?.id;
      if (!userId) {
        // User already existed for this synthetic email – look it up.
        const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        userId = list.data?.users?.find((u) => u.email === email)?.id;
      }
      if (!userId) throw new Error("অ্যাকাউন্ট তৈরি করা যায়নি");
    }

    await (supabaseAdmin as any).from("customer_profiles").upsert(
      {
        id: userId,
        phone,
        full_name: data.fullName?.trim() || existingProfile?.full_name || `কাস্টমার ${phone.slice(-4)}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw new Error(link.error.message);
    const tokenHash = link.data?.properties?.hashed_token;
    if (!tokenHash) throw new Error("লগইন টোকেন তৈরি হয়নি");

    return { tokenHash, email };
  });
