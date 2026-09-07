import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const C = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const out = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: C });
const norm = (v: string) => { const p = v.trim().replace(/\s+/g, ""); if (/^\+8801\d{9}$/.test(p)) return `0${p.slice(4)}`; if (/^8801\d{9}$/.test(p)) return `0${p.slice(3)}`; return p; };
const intl = (p: string) => /^01\d{9}$/.test(p) ? `88${p}` : p.replace(/^\+/, "");
const customerEmail = (phone: string) => `c${phone}@customer.sheikhseeds.app`;
const sha = async (v: string) => { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)); return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, "0")).join(""); };

async function sms(cfg: Record<string, unknown>, phone: string, message: string, code = "") {
  const t = String(cfg.url_template || "").trim(), k = String(cfg.api_key || "").trim();
  if (!t) throw Error("SMS URL Template সেট করা নেই"); if (!k) throw Error("SMS API Key সেট করা নেই");
  const isV2 = t.includes("plugin.hoorin.com/sms/api/send"); let r: Response;
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 15000);
  try {
    if (isV2) r = await fetch(t, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${k}` }, body: JSON.stringify({ phone, message }), signal: ac.signal });
    else { const u = t.replace(/\{api_key\}/g, encodeURIComponent(k)).replace(/\{phone\}/g, encodeURIComponent(phone)).replace(/\{phone_intl\}/g, encodeURIComponent(intl(phone))).replace(/\{message\}/g, encodeURIComponent(message)).replace(/\{code\}/g, encodeURIComponent(code)); r = await fetch(u, { headers: { Accept: "application/json,text/plain,*/*" }, signal: ac.signal }); }
    const text = (await r.text()).trim(); let j: any = null; try { j = JSON.parse(text); } catch {}
    if (!r.ok) throw Error(`SMS Provider HTTP ${r.status}: ${text.slice(0, 180)}`);
    if (j?.status && String(j.status).toLowerCase() !== "success") throw Error(`SMS Provider rejected: ${text.slice(0, 180)}`);
    if (j?.success === false || j?.ok === false || j?.status === false) throw Error(`SMS Provider rejected: ${text.slice(0, 180)}`);
    if (/\b(error|failed|failure|invalid|insufficient|unauthorized|forbidden|rejected)\b/i.test(text)) throw Error(`SMS Provider rejected: ${text.slice(0, 180)}`);
    return text;
  } finally { clearTimeout(tm); }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: C });
  try {
    const b = await req.json().catch(() => ({})); const a = String(b.action || ""), raw = String(b.phone || ""), phone = norm(raw);
    if (phone.length < 6) return out({ ok: false, sent: false, message: "সঠিক ফোন নম্বর দিন" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: i, error: ie } = await db.from("integrations").select("config,is_active").eq("name", "sms_hoorin").maybeSingle();
    if (ie) throw Error(`SMS config read failed: ${ie.message}`); if (!i?.is_active) return out({ ok: false, sent: false, message: "SMS Provider বন্ধ আছে — Admin → All API → SMS চালু করুন।" }, 400);
    const cfg = (i.config || {}) as Record<string, unknown>;
    if (a === "test") { await sms(cfg, phone, String(b.message || "Sheikh Seeds SMS Provider Test সফল হয়েছে।")); return out({ ok: true, sent: true, message: "Test SMS পাঠানো হয়েছে" }); }
    if (a === "send") {
      const { data: blocked } = await db.from("customer_profiles").select("is_blocked").eq("phone", phone).maybeSingle();
      if (blocked?.is_blocked) return out({ ok: false, sent: false, blocked: true, message: "এই কাস্টমার অ্যাকাউন্টটি ব্লক করা হয়েছে।" }, 403);
      const m1 = new Date(Date.now() - 60000).toISOString(), mh = new Date(Date.now() - 3600000).toISOString();
      const [{ data: r }, { data: h }] = await Promise.all([db.from("phone_otp_codes").select("id").eq("phone", phone).gte("created_at", m1).limit(1), db.from("phone_otp_codes").select("id").eq("phone", phone).gte("created_at", mh).limit(6)]);
      if (r?.length) return out({ ok: false, sent: false, message: "এক মিনিট পরে আবার চেষ্টা করুন" }, 429); if ((h?.length || 0) >= 5) return out({ ok: false, sent: false, message: "এক ঘণ্টায় সর্বোচ্চ ৫টি OTP পাঠানো যাবে" }, 429);
      const code = String(Math.floor(1000 + Math.random() * 9000)), ch = await sha(`${phone}:${code}`), ex = new Date(Date.now() + 300000).toISOString();
      const ins = await db.from("phone_otp_codes").insert({ phone, code_hash: ch, expires_at: ex, consumed: false }); if (ins.error) throw Error(`OTP save failed: ${ins.error.message}`);
      try { await sms(cfg, phone, `আপনার Login OTP: ${code}। এই কোড ৫ মিনিটের মধ্যে ব্যবহার করুন।`, code); } catch (e) { await db.from("phone_otp_codes").delete().eq("phone", phone).eq("code_hash", ch); throw e; }
      return out({ ok: true, sent: true, message: "OTP পাঠানো হয়েছে" });
    }
    if (a === "verify") {
      const { data: blocked } = await db.from("customer_profiles").select("is_blocked").eq("phone", phone).maybeSingle();
      if (blocked?.is_blocked) return out({ ok: false, verified: false, blocked: true, message: "এই কাস্টমার অ্যাকাউন্টটি ব্লক করা হয়েছে।" }, 403);
      const code = String(b.code || ""); if (!/^\d{4}$/.test(code)) return out({ ok: false, message: "৪ সংখ্যার OTP দিন" }, 400);
      const ch = await sha(`${phone}:${code}`); const { data: o } = await db.from("phone_otp_codes").select("id,expires_at,consumed").eq("phone", phone).eq("code_hash", ch).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!o) return out({ ok: false, message: "OTP সঠিক নয়" }, 400); if (o.consumed) return out({ ok: false, message: "OTP ইতিমধ্যে ব্যবহার হয়েছে" }, 400); if (new Date(o.expires_at).getTime() < Date.now()) return out({ ok: false, message: "OTP-এর মেয়াদ শেষ হয়েছে" }, 400);
      const ce = await db.from("phone_otp_codes").update({ consumed: true }).eq("id", o.id).eq("consumed", false); if (ce.error) throw Error(ce.error.message);
      const email = customerEmail(phone);
      const { data: cp } = await db.from("customer_profiles").select("id,full_name,is_blocked").eq("phone", phone).maybeSingle();
      if (cp?.is_blocked) return out({ ok: false, verified: false, blocked: true, message: "এই কাস্টমার অ্যাকাউন্টটি ব্লক করা হয়েছে।" }, 403);
      let uid: string | null = null;
      let existingCustomerId = cp?.id || null;
      if (existingCustomerId) {
        const { data: cu } = await db.auth.admin.getUserById(existingCustomerId);
        if (cu?.user?.email?.toLowerCase() === email.toLowerCase()) uid = existingCustomerId;
      }
      if (!uid) {
        const created = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { phone, full_name: typeof b.fullName === "string" ? b.fullName.trim() || null : null, customer: true } });
        if (!created.error) uid = created.data?.user?.id || null;
        else if (!/already/i.test(created.error.message)) throw Error(created.error.message);
        if (!uid) for (let page = 1; page <= 20 && !uid; page++) { const { data: users, error: ue } = await db.auth.admin.listUsers({ page, perPage: 1000 }); if (ue) throw Error(ue.message); uid = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id || null; if (users.users.length < 1000) break; }
      }
      if (!uid) throw Error("কাস্টমার অ্যাকাউন্ট তৈরি করা যায়নি");
      const fallbackName = typeof b.fullName === "string" && b.fullName.trim() ? b.fullName.trim() : (cp?.full_name || `কাস্টমার ${phone.slice(-4)}`);
      if (existingCustomerId && existingCustomerId !== uid) { const moved = await db.from("customer_profiles").update({ id: uid, phone, full_name: fallbackName, updated_at: new Date().toISOString() }).eq("phone", phone); if (moved.error) throw Error(`Customer profile save failed: ${moved.error.message}`); }
      else { const up = await db.from("customer_profiles").upsert({ id: uid, phone, full_name: fallbackName, updated_at: new Date().toISOString() }, { onConflict: "id" }); if (up.error) throw Error(`Customer profile save failed: ${up.error.message}`); }
      const { data: l, error: le } = await db.auth.admin.generateLink({ type: "magiclink", email }); if (le) throw Error(le.message); const tokenHash = l?.properties?.hashed_token; if (!tokenHash) throw Error("লগইন টোকেন তৈরি হয়নি");
      return out({ ok: true, verified: true, tokenHash, action_link: l?.properties?.action_link || null, email });
    }
    return out({ ok: false, message: "Invalid action" }, 400);
  } catch (e) { return out({ ok: false, sent: false, message: e instanceof Error ? e.message : "OTP service failed" }, 500); }
});
