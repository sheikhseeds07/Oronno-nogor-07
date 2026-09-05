import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { useCart } from "@/lib/cart-store";
import { taka } from "@/lib/format";
import { supabase } from "@/lib/personal-supabase/client";
import { toImg } from "@/lib/img";
import { placeOrder } from "@/lib/place-order.functions";
import { clearCheckoutSessionId, useCheckoutAutofill } from "@/lib/useCheckoutAutofill";
import { toast } from "sonner";
import { trackInitiateCheckout, trackPurchase } from "@/lib/fbq";
import { getFbContext } from "@/lib/fb-context";
import { BLOCKED_ORDER_MESSAGE, isBlockedOrderError } from "@/lib/order-block";

export const Route = createFileRoute("/checkout")({ component: Checkout, head: () => ({ meta: [{ title: "চেকআউট — Sheikh Seeds" }, { name: "robots", content: "noindex, nofollow" }] }) });

const PHONE_RE = /^01[3-9][0-9]{8}$/;
const PHONE_ERROR = "সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন (01XXXXXXXXX)";
const PHONE_MAX_ERROR = "সর্বোচ্চ ১১ ডিজিটের নাম্বার দেওয়া যাবে";
type Zone = { id: string; label: string; fee: number };
const DEFAULT_ZONES: Zone[] = [{ id: "all", label: "সারাদেশে হোম ডেলিভারি", fee: 50 }];
type DeliverySettings = { delivery_zones?: Zone[]; free_delivery_above?: number };
function zonesFromSettings(s?: DeliverySettings): Zone[] {
  const list = (s?.delivery_zones ?? [])
    .map((z, i) => ({ id: String(z?.id || `zone-${i + 1}`), label: String(z?.label || "").trim(), fee: Math.max(0, Math.floor(Number(z?.fee) || 0)) }))
    .filter((z) => z.label.length > 0);
  return list.length ? list : DEFAULT_ZONES;
}

function Checkout() {
  const items = useCart((s) => s.items);
  const subtotal = useCart((s) => s.subtotal());
  const clear = useCart((s) => s.clear);
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeOrder);

  const [submitting, setSubmitting] = useState(false);
  const { data: settingsRow } = useQuery(publicSiteSettingsQuery);
  const settings = ((settingsRow?.settings as DeliverySettings) ?? {}) as DeliverySettings;
  const zones = zonesFromSettings(settings);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "", zone: "all" });
  const [phoneErr, setPhoneErr] = useState("");
  const [blockedOpen, setBlockedOpen] = useState(false);
  const placedSuccessfully = useRef(false);
  const submitLockRef = useRef(false);

  const activeZone = zones.find((z) => z.id === form.zone) ?? zones[0];
  const freeAbove = Number(settings.free_delivery_above ?? 0);
  const delivery = freeAbove > 0 && subtotal >= freeAbove ? 0 : (activeZone?.fee ?? 0);
  const total = subtotal + delivery;
  const phoneValid = PHONE_RE.test(form.phone);

  const firedICRef = useRef(false);
  useEffect(() => {
    if (firedICRef.current || items.length === 0) return;
    firedICRef.current = true;
    trackInitiateCheckout(items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })), subtotal + delivery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { checkoutSessionId } = useCheckoutAutofill({
    form,
    setForm: (updater) => setForm((f) => updater(f) as typeof f),
    items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
    subtotal,
    total,
    deliveryFee: delivery,
    zone: activeZone?.label ?? form.zone,
  });

  useEffect(() => {
    if (!phoneValid || items.length === 0 || typeof window === "undefined") return;
    const saveAbandonedCheckout = () => {
      if (placedSuccessfully.current || !PHONE_RE.test(form.phone) || items.length === 0) return;
      const payload = {
        phone: form.phone,
        customer_name: form.name.trim(),
        customer_address: form.address.trim(),
        delivery_zone: activeZone?.label ?? form.zone,
        delivery_fee: delivery,
        subtotal,
        total,
        note: form.note.trim(),
        items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
      };
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        navigator.sendBeacon("/api/public/incomplete", blob);
      } catch {
        fetch("/api/public/incomplete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      }
    };
    const onPageHide = () => saveAbandonedCheckout();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [phoneValid, form.phone, form.name, form.address, form.note, form.zone, delivery, subtotal, total, items]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return toast.error("কার্ট খালি");
    if (!form.name.trim()) return toast.error("নাম দিন");
    if (!phoneValid) {
      const msg = form.phone.replace(/[^\d]/g, "").length > 11 ? PHONE_MAX_ERROR : PHONE_ERROR;
      setPhoneErr(msg);
      return toast.error(msg);
    }
    if (!form.address.trim()) return toast.error("ঠিকানা দিন");
    if (submitLockRef.current) return;

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fbCtx = getFbContext();
      const result = await runPlaceOrder({
        data: {
          customer_name: form.name.trim(),
          customer_phone: form.phone,
          customer_address: form.address.trim(),
          district: null,
          thana: null,
          notes: form.note?.trim() || null,
          delivery_fee: delivery,
          created_by: session?.user?.id ?? null,
          checkout_session_id: checkoutSessionId || null,
          items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
          ...fbCtx,
        },
      });
      placedSuccessfully.current = true;
      if (typeof window !== "undefined") trackPurchase(items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })), total, result.id);
      clearCheckoutSessionId(checkoutSessionId);
      clear();
      toast.success("অর্ডার সফল হয়েছে!");
      navigate({ to: "/order/$id", params: { id: result.id } });
    } catch (err) {
      submitLockRef.current = false;
      setSubmitting(false);
      if (isBlockedOrderError(err)) { setBlockedOpen(true); return; }
      toast.error("অর্ডার করতে সমস্যা: " + (err instanceof Error ? err.message : "অজানা"));
    }
  };

  if (items.length === 0) {
    return (
      <SiteLayout>
        <div className="container mx-auto px-3 py-16 text-center">
          <div className="mx-auto max-w-md rounded-3xl border bg-white p-8 shadow-sm">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-light text-2xl">🛒</div>
            <p className="mb-5 font-semibold text-muted-foreground">কার্ট খালি</p>
            <Link to="/shop" className="inline-flex rounded-full bg-brand px-7 py-3 font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark">শপিং করুন</Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <style>{`
        @keyframes coRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes coSheen { 0% { transform: translateX(-120%); } 60%,100% { transform: translateX(220%); } }
        .co-rise { animation: coRise .5s cubic-bezier(.22,1,.36,1) both; }
        .co-field { transition: border-color .2s ease, box-shadow .2s ease, background-color .2s ease; }
        .co-field:focus { box-shadow: 0 8px 22px -12px rgba(0,0,0,.35); }
        .co-zone { transition: transform .18s cubic-bezier(.22,1,.36,1), border-color .2s ease, background-color .2s ease, box-shadow .2s ease; }
        .co-zone:active { transform: scale(.985); }
        .co-cta { position: relative; overflow: hidden; transition: transform .18s cubic-bezier(.22,1,.36,1), box-shadow .25s ease, opacity .2s ease; }
        .co-cta:hover { transform: translateY(-1px); box-shadow: 0 16px 32px -14px rgba(0,0,0,.55); }
        .co-cta:active { transform: translateY(0) scale(.99); }
        .co-cta::after { content: ""; position: absolute; inset: 0 auto 0 0; width: 38%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.38), transparent); animation: coSheen 2.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .co-rise, .co-cta::after { animation: none; } }
      `}</style>

      <div className="container mx-auto max-w-6xl px-3 py-5 pb-32 sm:py-7 lg:pb-8">
        <div className="co-rise mx-auto mb-5 max-w-3xl text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand/10 bg-brand-light/70 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-brand-dark">✓ Secure Checkout</div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">অর্ডার সম্পন্ন করুন</h1>
          <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">আপনার তথ্য দিন এবং ক্যাশ অন ডেলিভারিতে অর্ডার কনফার্ম করুন</p>
        </div>

        <form onSubmit={submit} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-6">
          <div className="co-rise overflow-hidden rounded-3xl border border-brand/10 bg-white shadow-[0_18px_55px_-38px_rgba(20,80,45,.45)]" style={{ animationDelay: "80ms" }}>
            <div className="border-b bg-gradient-to-r from-brand-light/55 to-white px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-sm font-black text-white shadow-md shadow-brand/20">১</span>
                <div><h3 className="text-base font-black sm:text-lg">আপনার তথ্য</h3><p className="text-[11px] text-muted-foreground">সঠিক তথ্য দিলে দ্রুত ডেলিভারি নিশ্চিত করা যাবে</p></div>
              </div>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <label className="mb-1.5 block text-xs font-extrabold text-slate-700 sm:text-sm">আপনার নাম <span className="text-destructive">*</span></label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="co-field w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand/50 focus:bg-white focus:ring-2 focus:ring-brand/15" placeholder="পূর্ণ নাম লিখুন" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-extrabold text-slate-700 sm:text-sm">মোবাইল নাম্বার <span className="text-destructive">*</span></label>
                <input required type="tel" inputMode="numeric" value={form.phone} maxLength={16} onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, "").slice(0, 16); setForm({ ...form, phone: v }); setPhoneErr((prev) => (prev && PHONE_RE.test(v) ? "" : prev)); }} placeholder="01XXXXXXXXX" aria-invalid={Boolean(phoneErr)} className={`co-field w-full rounded-xl border bg-slate-50/60 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand/15 ${phoneErr ? "border-destructive bg-destructive/5 focus:border-destructive" : "border-slate-200 focus:border-brand/50"}`} />
                {phoneErr && <p className="mt-1 text-xs font-medium text-destructive">{phoneErr}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-extrabold text-slate-700 sm:text-sm">সম্পূর্ণ ঠিকানা <span className="text-destructive">*</span></label>
                <textarea required rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="co-field w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand/50 focus:bg-white focus:ring-2 focus:ring-brand/15" placeholder="বাসা/হোল্ডিং, রোড, এলাকা, থানা, জেলা" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-extrabold text-slate-700 sm:text-sm">ডেলিভারি এরিয়া <span className="text-destructive">*</span></label>
                <div className="flex flex-col gap-2">
                  {zones.map((z) => {
                    const selected = (activeZone?.id ?? form.zone) === z.id;
                    const fee = freeAbove > 0 && subtotal >= freeAbove ? 0 : z.fee;
                    return <button type="button" key={z.id} onClick={() => setForm({ ...form, zone: z.id })} aria-pressed={selected} className={`co-zone flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left ${selected ? "border-brand/40 bg-brand-light/60 shadow-sm" : "border-slate-200 bg-white hover:border-brand/20 hover:bg-slate-50"}`}>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-brand" : "border-slate-300"}`}><span className={`h-2.5 w-2.5 rounded-full bg-brand transition-transform ${selected ? "scale-100" : "scale-0"}`} /></span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{z.label}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-brand-dark">{taka(fee)}</span>
                    </button>;
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="co-rise overflow-hidden rounded-3xl border border-brand/10 bg-white shadow-[0_18px_55px_-38px_rgba(20,80,45,.45)] lg:sticky lg:top-24" style={{ animationDelay: "150ms" }}>
            <div className="border-b bg-gradient-to-r from-brand-light/55 to-white px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-sm font-black text-white shadow-md shadow-brand/20">২</span>
                <div><h3 className="text-base font-black sm:text-lg">আপনার অর্ডার</h3><p className="text-[11px] text-muted-foreground">{items.length}টি পণ্যের সারাংশ</p></div>
              </div>
            </div>
            <div className="p-5">
              <div className="max-h-72 space-y-3 overflow-auto pr-1">
                {items.map((i) => <div key={i.id} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5">
                  <img src={toImg(i.image, { w: 112, q: 70 })} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-xl border border-white object-cover shadow-sm" alt="" />
                  <div className="min-w-0 flex-1"><div className="line-clamp-2 text-sm font-bold text-slate-700">{i.name}</div><div className="mt-1 text-[11px] font-medium text-muted-foreground">{i.quantity} × {taka(i.price)}</div></div>
                  <div className="whitespace-nowrap text-sm font-black text-slate-800">{taka(i.price * i.quantity)}</div>
                </div>)}
              </div>
              <div className="mt-4 space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">সাবটোটাল</span><span className="font-bold">{taka(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ডেলিভারি চার্জ</span><span className="font-bold">{taka(delivery)}</span></div>
                <div className="mt-2 flex items-end justify-between border-t pt-3"><span className="font-black">সর্বমোট</span><span className="text-2xl font-black tracking-tight text-brand-dark">{taka(total)}</span></div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-brand/10 bg-brand-light/55 p-3 text-xs text-brand-dark"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white shadow-sm">৳</span><span><strong className="font-black">ক্যাশ অন ডেলিভারি</strong><br /><span className="text-brand-dark/75">পণ্য হাতে পেয়ে টাকা পরিশোধ করুন</span></span></div>
              <button type="submit" disabled={submitting} className="co-cta mt-4 hidden w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark py-3.5 text-base font-black text-white shadow-lg shadow-brand/20 disabled:opacity-50 lg:block">{submitting ? "অর্ডার হচ্ছে..." : `অর্ডার কনফার্ম করুন · ${taka(total)}`}</button>
              <p className="mt-2.5 text-center text-[10px] leading-relaxed text-muted-foreground">অর্ডার করে আপনি আমাদের <Link to="/" className="font-bold underline underline-offset-2">শর্তাবলী</Link> মেনে নিচ্ছেন</p>
            </div>
          </div>

          <div className="fixed bottom-[76px] left-0 right-0 z-40 border-t border-brand/10 bg-white/90 px-3 py-2.5 shadow-[0_-12px_30px_-18px_rgba(0,0,0,.55)] backdrop-blur-xl lg:hidden" style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}>
            <div className="mx-auto flex max-w-6xl items-center gap-3">
              <div className="shrink-0 leading-tight"><div className="text-[10px] font-medium text-muted-foreground">সর্বমোট</div><div className="font-black text-brand-dark">{taka(total)}</div></div>
              <button type="submit" disabled={submitting} className="co-cta flex-1 rounded-full bg-gradient-to-r from-brand to-brand-dark py-3 text-sm font-black text-white shadow-lg shadow-brand/20 disabled:opacity-50">{submitting ? "অর্ডার হচ্ছে..." : "অর্ডার কনফার্ম করুন"}</button>
            </div>
          </div>
        </form>
      </div>

      {blockedOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setBlockedOpen(false)}>
        <div className="w-full max-w-sm animate-in zoom-in-95 rounded-3xl border border-red-100 bg-white p-6 text-center shadow-2xl duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-red-50 text-3xl">🚫</div>
          <h2 className="text-lg font-extrabold text-slate-900">অর্ডার করা সম্ভব নয়</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{BLOCKED_ORDER_MESSAGE}</p>
          <p className="mt-2 text-xs text-slate-500">কোনো ভুল হয়েছে মনে হলে আমাদের সাথে যোগাযোগ করুন।</p>
          <button type="button" onClick={() => setBlockedOpen(false)} className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800">ঠিক আছে</button>
        </div>
      </div>}
    </SiteLayout>
  );
}
