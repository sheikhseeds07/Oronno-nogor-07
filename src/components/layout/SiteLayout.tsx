import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { TopBar } from "./TopBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { VisitTracker } from "./VisitTracker";
import { SeoFromSettings } from "./SeoFromSettings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/personal-supabase/client";
import { taka } from "@/lib/format";
import { format } from "date-fns";
import { CheckCircle2, Clock3, Gift, MapPin, Package, Phone, Truck, X } from "lucide-react";
import { BrandLoader } from "./BrandLoader";
import { useCart } from "@/lib/cart-store";

const statusBn: Record<string, string> = { pending: "অপেক্ষমাণ", confirmed: "কনফার্মড", processing: "প্রস্তুত হচ্ছে", shipped: "ডেলিভারিতে", delivered: "ডেলিভারি সম্পন্ন", cancelled: "বাতিল", web_pending: "অপেক্ষমাণ", rts: "RTS", pending_return: "রিটার্ন প্রসেস", returned: "রিটার্ন সম্পন্ন", partial: "আংশিক ডেলিভারি", hold: "হোল্ড" };
const steps = ["pending", "confirmed", "processing", "shipped", "delivered"];

type Props = { children: React.ReactNode };

export function SiteLayout({ children }: Props) {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isProfile = pathname === "/profile";
  const isCart = pathname === "/cart";
  const isCheckout = pathname === "/checkout";
  const isOdcLanding = pathname === "/landing/odc";
  const isKaralaLanding = pathname === "/landing/karala";
  const isCleanShell = isProfile || isOdcLanding || isKaralaLanding;
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const cartSubtotal = useCart((s) => s.subtotal());
  const [offerPopup, setOfferPopup] = useState<"intro" | "500" | "1000" | null>(null);
  const lastOffer = useRef(0);
  const landingPage = pathname === "/landing" || pathname.startsWith("/landing/");
  const isSeedOfferPage = pathname === "/" || pathname === "/shop" || pathname.startsWith("/category/");
  useEffect(() => {
    if (!isSeedOfferPage || landingPage || isProfile || isCheckout || isCart) return;
    if (cartSubtotal < 500 && !sessionStorage.getItem("oronno-seed-offer-intro")) {
      const timer = window.setTimeout(() => { if (cartSubtotal < 500) setOfferPopup("intro"); sessionStorage.setItem("oronno-seed-offer-intro", "1"); }, 2600);
      return () => window.clearTimeout(timer);
    }
  }, [isSeedOfferPage, landingPage, isProfile, isCheckout, isCart, cartSubtotal]);
  useEffect(() => {
    if (!isSeedOfferPage || landingPage || isProfile || isCheckout || isCart) return;
    const level = cartSubtotal >= 1000 ? 1000 : cartSubtotal >= 500 ? 500 : 0;
    if (level > lastOffer.current) { lastOffer.current = level; setOfferPopup(level === 1000 ? "1000" : "500"); }
    if (level === 0) lastOffer.current = 0;
  }, [cartSubtotal, isSeedOfferPage, landingPage, isProfile, isCheckout, isCart]);

  useEffect(() => {
    if (!isProfile) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const match = link.getAttribute("href")?.match(/^\/order\/([^/?#]+)/);
      if (!match) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedOrderId(match[1]);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isProfile]);

  // The mobile checkout CTA sits outside the checkout <form>. It previously used
  // document.querySelector("form"), which can select the Header search form first
  // and navigate away instead of submitting the checkout form. Handle that CTA
  // at capture phase and explicitly submit the checkout form only.
  useEffect(() => {
    if (!isCheckout) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest(".co-submit") as HTMLButtonElement | null;
      if (!button || button.disabled) return;
      const checkoutForm = document.querySelector(".co-checkout-shell form") as HTMLFormElement | null;
      if (!checkoutForm) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      checkoutForm.requestSubmit();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isCheckout]);

  const detailQ = useQuery({
    queryKey: ["profile-order-detail", selectedOrderId],
    enabled: isProfile && !!selectedOrderId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_customer_order_detail", { p_order_id: selectedOrderId });
      if (error) throw error;
      return data ?? null;
    },
  });
  const order = detailQ.data as any;
  const currentStep = order ? steps.indexOf(order.status) : -1;
  const cancelled = order?.status === "cancelled";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!isCleanShell && <TopBar />}
      {!isCleanShell && <Header />}
      <main className={`relative z-0 flex-1 pb-24 ${isOdcLanding ? "odc-landing-main" : ""}`}>{children}</main>
      {isOdcLanding && <style>{`.odc-landing-main > :first-child { margin-top: 0 !important; }.odc-landing-main > :first-child > :first-child { margin-top: 0 !important; padding-top: 0 !important; }.odc-landing-main section:first-child { margin-top: 0 !important; }.odc-landing-main section:first-child > :first-child { margin-top: 0 !important; padding-top: 0 !important; }`}</style>}
      {!isCleanShell && <Footer />}
      <VisitTracker />
      {offerPopup && <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md" onMouseDown={(e) => { if (e.target === e.currentTarget) setOfferPopup(null); }}><section lang="bn" role="dialog" aria-modal="true" aria-label="আপনার জন্য বিশেষ অফার" className="relative flex min-h-[490px] w-full max-w-[420px] flex-col justify-center overflow-hidden rounded-[30px] border border-white/90 bg-gradient-to-br from-[#fffaf0] via-white to-[#f4efff] px-5 py-7 text-center shadow-[0_28px_90px_rgba(66,35,95,0.30)] sm:min-h-[510px] sm:px-7 sm:py-8" style={{ fontFamily: "'Noto Serif Bengali', 'Hind Siliguri', serif" }}><div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-fuchsia-200/45 blur-3xl" /><div className="pointer-events-none absolute -bottom-16 -left-14 h-48 w-48 rounded-full bg-amber-200/55 blur-3xl" /><div className="pointer-events-none absolute left-8 top-20 h-2 w-2 rotate-45 rounded-sm bg-amber-400/80" /><div className="pointer-events-none absolute right-10 top-28 h-2.5 w-2.5 rotate-45 rounded-sm bg-fuchsia-400/70" /><div className="pointer-events-none absolute bottom-28 right-8 h-2 w-2 rotate-45 rounded-sm bg-emerald-400/70" /><button type="button" onClick={() => setOfferPopup(null)} aria-label="পপআপ বন্ধ করুন" className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:rotate-90 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"><X className="h-5 w-5" /></button><div className="relative mx-auto mb-3 flex h-[68px] w-[68px] items-center justify-center rounded-[23px] border border-white bg-gradient-to-br from-amber-400 via-orange-500 to-fuchsia-600 text-white shadow-xl shadow-fuchsia-900/20 ring-4 ring-amber-100"><Gift className="h-9 w-9 drop-shadow" /><span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-xs font-black text-white shadow">✦</span></div><p className="relative mb-1 text-[10px] font-black tracking-[.18em] text-orange-600">বিশেষ উপহার • SPECIAL GIFT</p><p className="relative text-[25px] font-black leading-tight tracking-tight text-emerald-950 sm:text-[28px]">আপনার জন্য বিশেষ অফার</p><div className="relative mx-auto mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-emerald-600 to-amber-400" />{offerPopup === "intro" ? <div className="relative mt-5 space-y-3 text-left"><div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-white via-emerald-50/90 to-white p-4 shadow-[0_8px_22px_rgba(16,80,50,0.09)] sm:p-4"><div className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">🌱</span><div><p className="text-[14px] font-bold leading-6 text-slate-800 sm:text-[15px]">৫০০ টাকা বা তার বেশি টাকার অর্ডার করলে</p><p className="mt-0.5 text-[13px] font-black leading-6 text-emerald-800 sm:text-sm">ডেলিভারি চার্জ ফ্রি + ১ প্যাকেট বীজ ফ্রি পাবেন</p></div></div></div><div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-white via-amber-50/90 to-white p-4 shadow-[0_8px_22px_rgba(140,95,20,0.09)] sm:p-4"><div className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg">🎁</span><div><p className="text-[14px] font-bold leading-6 text-slate-800 sm:text-[15px]">১,০০০ টাকার অর্ডার করলে</p><p className="mt-0.5 text-[13px] font-black leading-6 text-amber-800 sm:text-sm">ডেলিভারি চার্জ ফ্রি + ২ প্যাকেট বীজ ফ্রি পাবেন</p></div></div></div></div> : <p className="relative mt-5 text-sm font-semibold leading-7 text-slate-700">আপনি {offerPopup === "1000" ? "১,০০০" : "৫০০"} টাকার অর্ডার কার্টে যোগ করেছেন। এখন বীজ ক্যাটাগরি থেকে {offerPopup === "1000" ? "২ প্যাকেট" : "১ প্যাকেট"} বীজ ফ্রিতে নিতে পারবেন।</p>}<button type="button" onClick={() => setOfferPopup(null)} className="relative mt-5 w-full rounded-xl border border-orange-500/70 bg-gradient-to-r from-orange-500 via-rose-500 to-fuchsia-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-rose-900/20 transition hover:-translate-y-0.5 hover:brightness-105">ঠিক আছে</button></section></div>}

      <SeoFromSettings />

      {isProfile && selectedOrderId && <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedOrderId(null); }}>
        <div className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-[28px] border border-white/20 bg-background shadow-[0_30px_100px_rgba(0,0,0,.35)] animate-in slide-in-from-bottom-8 duration-300 sm:rounded-[28px] sm:slide-in-from-bottom-3">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-brand/20 via-brand-light/20 to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-between border-b px-4 py-3.5 sm:px-6"><div><div className="flex items-center gap-2 text-sm font-black"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white shadow-lg shadow-brand/20"><Package className="h-4 w-4" /></span>অর্ডারের বিস্তারিত</div><p className="mt-0.5 text-[10px] text-muted-foreground">আপনার অর্ডারের সম্পূর্ণ তথ্য</p></div><button onClick={() => setSelectedOrderId(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border bg-background/80 transition hover:rotate-90 hover:border-brand hover:text-brand"><X className="h-4 w-4" /></button></div>
          {detailQ.isLoading ? <div className="flex min-h-[320px] items-center justify-center"><BrandLoader /></div> : detailQ.isError || !order ? <div className="p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500"><X className="h-5 w-5" /></div><p className="mt-3 text-sm font-black">অর্ডারের তথ্য লোড করা যায়নি</p><p className="mt-1 text-xs text-muted-foreground">অর্ডারটি আর পাওয়া যাচ্ছে না অথবা আপনার অ্যাক্সেস নেই।</p><button onClick={() => detailQ.refetch()} className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white">আবার চেষ্টা করুন</button></div> : <div className="max-h-[calc(92vh-72px)] overflow-y-auto p-4 sm:p-6">
            <div className="rounded-2xl border bg-gradient-to-br from-brand-light/55 via-background to-background p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">ORDER ID</p><h3 className="mt-1 text-xl font-black tracking-tight">#{String(order.invoice_no || order.id).slice(-8).toUpperCase()}</h3><p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="h-3 w-3" />{format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black ${cancelled ? "bg-red-100 text-red-700" : "bg-brand text-white shadow-md shadow-brand/20"}`}><CheckCircle2 className="h-3.5 w-3.5" />{statusBn[order.status] || order.status}</span></div></div>
            <div className="mt-4 rounded-2xl border bg-background p-4"><div className="flex items-center justify-between"><div><p className="text-[11px] font-black">অর্ডার স্ট্যাটাস</p><p className="mt-0.5 text-[10px] text-muted-foreground">আপনার অর্ডার এখন কোথায় আছে</p></div><Truck className="h-5 w-5 text-brand" /></div>{cancelled ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">এই অর্ডারটি বাতিল করা হয়েছে।</div> : <><div className="mt-5 flex items-start">{steps.map((step, i) => { const done = currentStep >= i; return <div key={step} className="relative flex flex-1 flex-col items-center text-center"><div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background transition-all duration-500 ${done ? "border-brand bg-brand text-white shadow-lg shadow-brand/20 scale-105" : "border-muted text-muted-foreground"}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[9px] font-black">{i + 1}</span>}</div>{i < steps.length - 1 && <div className={`absolute left-1/2 top-4 h-0.5 w-full transition-all duration-700 ${currentStep > i ? "bg-brand" : "bg-muted"}`} />}</div>; })}</div><div className="mt-1 grid grid-cols-5 text-center text-[8px] font-bold text-muted-foreground"><span>অর্ডার</span><span>কনফার্ম</span><span>প্রস্তুত</span><span>ডেলিভারি</span><span>সম্পন্ন</span></div></>}</div>
            <div className="mt-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black">অর্ডার করা পণ্য</h3><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-black">{order.order_items?.length || 0} টি</span></div><div className="overflow-hidden rounded-2xl border">{order.order_items?.length ? order.order_items.map((item: any) => <div key={item.id} className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0"><div className="min-w-0"><p className="truncate text-xs font-black">{item.product_name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{taka(Number(item.price || 0))} × {item.quantity}</p></div><strong className="shrink-0 text-xs text-brand-dark">{taka(Number(item.subtotal || 0))}</strong></div>) : <div className="p-4 text-center text-xs text-muted-foreground">পণ্যের তথ্য পাওয়া যায়নি।</div>}</div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border p-3"><p className="text-[10px] font-black text-muted-foreground">ডেলিভারি তথ্য</p><div className="mt-2 space-y-1.5 text-xs"><div className="font-black">{order.customer_name}</div><div className="flex items-start gap-1.5 text-muted-foreground"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />{order.customer_phone}</div><div className="flex items-start gap-1.5 text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /><span>{[order.customer_address, order.thana, order.district].filter(Boolean).join(", ") || "ঠিকানা দেওয়া নেই"}</span></div></div></div><div className="rounded-2xl border p-3"><p className="text-[10px] font-black text-muted-foreground">অর্ডার মোট</p><div className="mt-2 space-y-1.5 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">সাবটোটাল</span><span>{taka(Number(order.subtotal || 0))}</span></div><div className="flex justify-between"><span className="text-muted-foreground">ডেলিভারি চার্জ</span><span>{taka(Number(order.delivery_fee || 0))}</span></div><div className="my-1 border-t" /><div className="flex justify-between text-sm font-black"><span>সর্বমোট</span><span className="text-brand-dark">{taka(Number(order.total || 0))}</span></div></div></div></div>
            {(order.courier_display_name || order.courier_consignment) && <div className="mt-4 rounded-2xl bg-brand-light/45 p-3"><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-brand" /><div><p className="text-xs font-black">কুরিয়ার তথ্য</p><p className="text-[10px] text-muted-foreground">{order.courier_display_name || "কুরিয়ার"}{order.courier_consignment ? ` • ${order.courier_consignment}` : ""}</p></div></div></div>}
          </div>}
        </div>
      </div>}
    </div>
  );
}
