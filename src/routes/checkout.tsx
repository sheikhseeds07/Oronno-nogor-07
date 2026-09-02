import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
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

export const Route = createFileRoute("/checkout")({ component: Checkout });

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
  const { data: settingsRow } = useQuery({ queryKey: ["site-settings-delivery"], queryFn: async () => (await supabase.from("site_settings").select("settings").maybeSingle()).data, staleTime: 30_000, refetchOnMount: "always" });
  const settings = ((settingsRow?.settings as DeliverySettings) ?? {}) as DeliverySettings;
  const zones = zonesFromSettings(settings);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "", zone: "all" });
  const [phoneErr, setPhoneErr] = useState("");
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
    trackInitiateCheckout(
      items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
      subtotal + delivery,
    );
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

  // Save only when the checkout page is actually being left. A valid 11-digit
  // phone is the only required signal; the latest customer/product details win.
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
      if (typeof window !== "undefined") {
        trackPurchase(
          items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
          total,
          result.id,
        );
      }
      clearCheckoutSessionId(checkoutSessionId);
      clear();
      toast.success("অর্ডার সফল হয়েছে!");
      navigate({ to: "/order/$id", params: { id: result.id } });
    } catch (err) {
      submitLockRef.current = false;
      setSubmitting(false);
      toast.error("অর্ডার করতে সমস্যা: " + (err instanceof Error ? err.message : "অজানা"));
    }
  };

  if (items.length === 0) {
    return (
      <SiteLayout>
        <div className="container mx-auto px-3 py-12 text-center">
          <p className="mb-4 text-muted-foreground">কার্ট খালি</p>
          <Link to="/shop" className="bg-brand text-white px-6 py-2.5 rounded-full font-semibold">শপিং করুন</Link>
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
        .co-field:focus { box-shadow: 0 6px 18px -10px rgba(0,0,0,.35); }
        .co-zone { transition: transform .18s cubic-bezier(.22,1,.36,1), border-color .2s ease, background-color .2s ease, box-shadow .2s ease; }
        .co-zone:active { transform: scale(.985); }
        .co-cta { position: relative; overflow: hidden; transition: transform .18s cubic-bezier(.22,1,.36,1), box-shadow .25s ease, opacity .2s ease; }
        .co-cta:hover { transform: translateY(-1px); box-shadow: 0 14px 30px -14px rgba(0,0,0,.55); }
        .co-cta:active { transform: translateY(0) scale(.99); }
        .co-cta::after { content: ""; position: absolute; inset: 0 auto 0 0; width: 38%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.38), transparent); animation: coSheen 2.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .co-rise, .co-cta::after { animation: none; } }
      `}</style>
      <div className="container mx-auto px-3 py-6 max-w-6xl pb-28 lg:pb-6">
        <h1 className="co-rise text-2xl font-bold mb-1 text-center">অর্ডার সম্পন্ন করুন</h1>
        <p className="co-rise text-center text-xs text-muted-foreground mb-5" style={{ animationDelay: "60ms" }}>নিরাপদ চেকআউট · ক্যাশ অন ডেলিভারি</p>
        <form onSubmit={submit} className="grid lg:grid-cols-[1fr_400px] gap-6">
          <div className="co-rise bg-white border rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm" style={{ animationDelay: "90ms" }}>
            <div className="flex items-center gap-2 pb-2 border-b">
              <span className="bg-brand text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">১</span>
              <h3 className="font-bold text-lg">আপনার তথ্য দিন</h3>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">আপনার নাম <span className="text-destructive">*</span></label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="co-field w-full border rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40" placeholder="পূর্ণ নাম লিখুন" />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">মোবাইল নাম্বার <span className="text-destructive">*</span></label>
              <input
                required
                type="tel"
                inputMode="numeric"
                value={form.phone}
                maxLength={16}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "").slice(0, 16);
                  setForm({ ...form, phone: v });
                  setPhoneErr((prev) => (prev && PHONE_RE.test(v) ? "" : prev));
                }}
                placeholder="01XXXXXXXXX"
                aria-invalid={Boolean(phoneErr)}
                className={`co-field w-full border rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 ${phoneErr ? "border-destructive bg-destructive/5 focus:ring-destructive/40" : ""}`}
              />
              {phoneErr && <p className="text-xs text-destructive mt-1">{phoneErr}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">সম্পূর্ণ ঠিকানা <span className="text-destructive">*</span></label>
              <textarea required rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="co-field w-full border rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none" placeholder="বাসা/হোল্ডিং, রোড, এলাকা, থানা, জেলা" />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">ডেলিভারি এরিয়া <span className="text-destructive">*</span></label>
              <div className="flex flex-col gap-1.5">
                {zones.map((z) => {
                  const selected = (activeZone?.id ?? form.zone) === z.id;
                  const fee = freeAbove > 0 && subtotal >= freeAbove ? 0 : z.fee;
                  return (
                    <button type="button" key={z.id} onClick={() => setForm({ ...form, zone: z.id })} aria-pressed={selected} className={`co-zone w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left ${selected ? "border-brand bg-brand-light shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
                      <span className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected ? "border-brand" : "border-gray-300"}`}>
                        <span className={`w-2 h-2 rounded-full transition-transform ${selected ? "bg-brand scale-100" : "scale-0"}`} />
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm font-semibold">{z.label}</span>
                      <span className="shrink-0 text-xs font-bold text-brand-dark">{taka(fee)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="co-rise bg-white border rounded-2xl p-5 h-fit lg:sticky lg:top-24 shadow-sm" style={{ animationDelay: "150ms" }}>
            <div className="flex items-center gap-2 pb-3 border-b mb-3">
              <span className="bg-brand text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">২</span>
              <h3 className="font-bold text-lg">আপনার অর্ডার</h3>
            </div>
            <div className="space-y-3 max-h-72 overflow-auto">
              {items.map((i) => (
                <div key={i.id} className="flex gap-2.5 text-sm">
                  <img src={toImg(i.image, { w: 112, q: 70 })} loading="lazy" decoding="async" className="w-14 h-14 object-cover rounded-lg border" alt="" />
                  <div className="flex-1 min-w-0">
                    <div className="line-clamp-2 font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{i.quantity} × {taka(i.price)}</div>
                  </div>
                  <div className="font-bold whitespace-nowrap">{taka(i.price * i.quantity)}</div>
                </div>
              ))}
            </div>
            <div className="border-t mt-3 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm"><span>সাবটোটাল</span><span>{taka(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span>ডেলিভারি চার্জ</span><span>{taka(delivery)}</span></div>
              <div className="flex justify-between font-bold text-xl pt-2 border-t mt-1.5"><span>মোট</span><span className="text-brand-dark">{taka(total)}</span></div>
            </div>
            <div className="mt-3 bg-brand-light rounded-lg p-2.5 text-xs text-center"><strong>ক্যাশ অন ডেলিভারি</strong> — পণ্য পেয়ে টাকা পরিশোধ করুন</div>
            <button type="submit" disabled={submitting} className="co-cta mt-3 hidden lg:block w-full bg-brand text-white py-3.5 rounded-lg font-bold text-base hover:bg-brand-dark disabled:opacity-50">
              {submitting ? "অর্ডার হচ্ছে..." : `অর্ডার কনফার্ম করুন (${taka(total)})`}
            </button>
            <p className="text-xs text-center text-muted-foreground mt-2">অর্ডার করে আপনি আমাদের <Link to="/" className="underline">শর্তাবলী</Link> মেনে নিচ্ছেন</p>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t bg-white/85 backdrop-blur px-3 py-2.5 shadow-[0_-8px_24px_-18px_rgba(0,0,0,.5)]" style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}>
            <div className="flex items-center gap-3 max-w-6xl mx-auto">
              <div className="shrink-0 leading-tight">
                <div className="text-[10px] text-muted-foreground">মোট</div>
                <div className="font-bold text-brand-dark">{taka(total)}</div>
              </div>
              <button type="submit" disabled={submitting} className="co-cta flex-1 bg-brand text-white py-3 rounded-full font-bold text-sm hover:bg-brand-dark disabled:opacity-50">
                {submitting ? "অর্ডার হচ্ছে..." : "অর্ডার কনফার্ম করুন"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </SiteLayout>
  );
}
