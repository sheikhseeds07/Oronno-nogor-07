import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
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
const ZONES = [
  { id: "all", label: "সারাদেশে হোম ডেলিভারি", fee: 50 },
];

function Checkout() {
  const items = useCart((s) => s.items);
  const subtotal = useCart((s) => s.subtotal());
  const clear = useCart((s) => s.clear);
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeOrder);

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "", zone: "all" });
  const [phoneErr, setPhoneErr] = useState("");

  const delivery = ZONES.find((z) => z.id === form.zone)?.fee ?? 50;
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
    zone: form.zone,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return toast.error("কার্ট খালি");
    if (!form.name.trim()) return toast.error("নাম দিন");
    if (!phoneValid) {
      setPhoneErr(PHONE_ERROR);
      return toast.error("ফোন নাম্বার সঠিক নয়");
    }
    if (!form.address.trim()) return toast.error("ঠিকানা দিন");

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
      <div className="container mx-auto px-3 py-6 max-w-6xl">
        <h1 className="text-2xl font-bold mb-5 text-center">অর্ডার সম্পন্ন করুন</h1>
        <form onSubmit={submit} className="grid lg:grid-cols-[1fr_400px] gap-6">
          <div className="bg-white border rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b">
              <span className="bg-brand text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">১</span>
              <h3 className="font-bold text-lg">আপনার তথ্য দিন</h3>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">আপনার নাম <span className="text-destructive">*</span></label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40" placeholder="পূর্ণ নাম লিখুন" />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">মোবাইল নাম্বার <span className="text-destructive">*</span></label>
              <input
                required
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm({ ...form, phone: v });
                  setPhoneErr(v && !PHONE_RE.test(v) ? PHONE_ERROR : "");
                }}
                onBlur={() => setPhoneErr(form.phone && !phoneValid ? PHONE_ERROR : "")}
                placeholder="01XXXXXXXXX"
                aria-invalid={Boolean(form.phone && !phoneValid)}
                className={`w-full border rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 ${phoneErr ? "border-destructive" : ""}`}
              />
              {phoneErr && <p className="text-xs text-destructive mt-1">{phoneErr}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">সম্পূর্ণ ঠিকানা <span className="text-destructive">*</span></label>
              <textarea required rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full border rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none" placeholder="বাসা/হোল্ডিং, রোড, এলাকা, থানা, জেলা" />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">ডেলিভারি এরিয়া <span className="text-destructive">*</span></label>
              <div className="grid grid-cols-1 gap-2.5">
                {ZONES.map((z) => (
                  <button type="button" key={z.id} onClick={() => setForm({ ...form, zone: z.id })} className={`border-2 rounded-lg p-3 text-left transition ${form.zone === z.id ? "border-brand bg-brand-light" : "border-gray-200 hover:border-gray-300"}`}>
                    <div className="font-semibold text-sm">{z.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">ডেলিভারি চার্জ {taka(z.fee)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">নোট (ঐচ্ছিক)</label>
              <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full border rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none" placeholder="বিশেষ নির্দেশনা থাকলে লিখুন" />
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-5 h-fit lg:sticky lg:top-24 shadow-sm">
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
            <button type="submit" disabled={submitting || !phoneValid} className="mt-3 w-full bg-brand text-white py-3.5 rounded-lg font-bold text-base hover:bg-brand-dark disabled:opacity-50 transition">
              {submitting ? "অর্ডার হচ্ছে..." : `অর্ডার কনফার্ম করুন (${taka(total)})`}
            </button>
            <p className="text-xs text-center text-muted-foreground mt-2">অর্ডার করে আপনি আমাদের <Link to="/" className="underline">শর্তাবলী</Link> মেনে নিচ্ছেন</p>
          </div>
        </form>
      </div>
    </SiteLayout>
  );
}
