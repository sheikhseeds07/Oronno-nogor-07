import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

function normalize(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("88")) return d;
  if (d.startsWith("0")) return "88" + d;
  return "88" + d;
}
function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

async function getSmsConfig(): Promise<{ url_template: string; api_key: string } | null> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("config,is_active")
    .eq("name", "sms_hoorin")
    .maybeSingle();
  if (!data?.is_active) return null;
  const cfg = (data.config as Record<string, string>) || {};
  if (!cfg.url_template) return null;
  return { url_template: cfg.url_template, api_key: cfg.api_key || "" };
}

export const sendPhoneOtp = createServerFn({ method: "POST" })
  .validator(zodValidator(z.object({ phone: z.string().min(6).max(20) })))
  .handler(async ({ data }) => {
    const phone = normalize(data.phone);
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const expires = new Date(Date.now() + 10 * 60_000);

    await supabaseAdmin.from("phone_otp_codes").insert({
      phone,
      code_hash: hashCode(code),
      expires_at: expires.toISOString(),
    });

    const cfg = await getSmsConfig();
    if (!cfg) {
      // Never leak the OTP to the client — log server-side only.
      console.warn(`[OTP] SMS provider not configured. Code for ${phone}: ${code}`);
      return { ok: false, sent: false, message: "SMS provider সেট নেই — Admin → All API → SMS এ গিয়ে সেট করো।" };
    }

    const url = cfg.url_template
      .replace(/\{api_key\}/g, encodeURIComponent(cfg.api_key))
      .replace(/\{phone\}/g, encodeURIComponent(phone))
      .replace(/\{message\}/g, encodeURIComponent(`আপনার লগইন কোড: ${code}`))
      .replace(/\{code\}/g, encodeURIComponent(code));

    try {
      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json,text/plain" } });
      const text = await res.text();
      if (!res.ok) {
        return { ok: false, sent: false, message: `SMS ব্যর্থ: HTTP ${res.status} ${text.slice(0, 120)}` };
      }
      return { ok: true, sent: true, message: "OTP পাঠানো হয়েছে" };
    } catch (e) {
      return { ok: false, sent: false, message: e instanceof Error ? e.message : "Network error" };
    }
  });

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .validator(zodValidator(z.object({ phone: z.string().min(6).max(20), code: z.string().length(4) })))
  .handler(async ({ data }) => {
    const phone = normalize(data.phone);
    const hash = hashCode(data.code);

    const { data: row } = await supabaseAdmin
      .from("phone_otp_codes")
      .select("id,expires_at,consumed")
      .eq("phone", phone)
      .eq("code_hash", hash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) throw new Error("ভুল কোড");
    if (row.consumed) throw new Error("এই কোড ব্যবহার করা হয়ে গেছে");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("কোডের মেয়াদ শেষ");

    await supabaseAdmin.from("phone_otp_codes").update({ consumed: true }).eq("id", row.id);

    // Find user by phone in employees or profiles
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("user_id,email")
      .eq("phone", data.phone)
      .maybeSingle();

    let email: string | null = emp?.email ?? null;
    let userId: string | null = emp?.user_id ?? null;

    if (!email) {
      // search profiles
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id,phone")
        .eq("phone", data.phone)
        .maybeSingle();
      if (prof) {
        userId = prof.id;
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(prof.id);
        email = u?.user?.email ?? null;
      }
    }

    if (!userId || !email) throw new Error("এই নাম্বারে কোনো একাউন্ট নেই");

    // Generate magic link to sign in (we'll return action_link for client redirect)
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error) throw new Error(error.message);

    return { ok: true, action_link: link.properties?.action_link ?? null, email };
  });
