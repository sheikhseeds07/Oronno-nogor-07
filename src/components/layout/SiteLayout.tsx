import { useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { VisitTracker } from "./VisitTracker";
import { SeoFromSettings } from "./SeoFromSettings";
import { CustomerBottomNav } from "./CustomerBottomNav";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/personal-supabase/client";
import { taka } from "@/lib/format";
import { format } from "date-fns";
import { CheckCircle2, Clock3, MapPin, Package, Phone, Truck, X } from "lucide-react";
import { BrandLoader } from "./BrandLoader";

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
      <SeoFromSettings />
      {!isOdcLanding && !isKaralaLanding && <CustomerBottomNav hidden={isCart || isCheckout} />}

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
