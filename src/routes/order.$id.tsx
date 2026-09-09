import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicOrder } from "@/lib/public-order.functions";
import { taka, bnDigits } from "@/lib/format";
import { CheckCircle2, Facebook, Download, ShoppingBag, User, ArrowRight, Sparkles, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/order/$id")({ component: OrderPage, head: () => ({ meta: [{ title: "অর্ডার সফল — Sheikh Seeds" }, { name: "robots", content: "noindex, nofollow" }] }) });

const statusBn: Record<string, string> = { web_pending: "ওয়েব পেন্ডিং", pending: "অপেক্ষমাণ", confirmed: "কনফার্মড", processing: "প্রস্তুত হচ্ছে", rts: "RTS", shipped: "ডেলিভারিতে", delivered: "ডেলিভারি সম্পন্ন", cancelled: "বাতিল", returned: "ফেরত", hold: "হোল্ড" };
const FACEBOOK_PAGE_URL = "https://www.facebook.com/share/1DoMWrXv2i/";

function drawInvoice(order: any): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000; canvas.height = 1380;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Invoice canvas unavailable"));
    const W = canvas.width;
    ctx.fillStyle = "#f3f8f5"; ctx.fillRect(0, 0, W, canvas.height);
    ctx.fillStyle = "#ffffff"; ctx.roundRect(45, 45, W - 90, canvas.height - 90, 30); ctx.fill();
    ctx.fillStyle = "#166534"; ctx.font = "900 46px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText("Sheikh Seeds", 85, 125);
    ctx.fillStyle = "#64748b"; ctx.font = "24px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText("অরিজিনাল বীজ ও গার্ডেন পণ্য", 85, 165);
    const no = `#${order.id.slice(0, 8).toUpperCase()}`;
    ctx.textAlign = "right"; ctx.fillStyle = "#17231c"; ctx.font = "900 28px Arial, sans-serif"; ctx.fillText("INVOICE", W - 85, 120);
    ctx.font = "700 25px Arial, sans-serif"; ctx.fillText(no, W - 85, 160);
    ctx.fillStyle = "#64748b"; ctx.font = "20px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText(new Date(order.created_at).toLocaleDateString("bn-BD"), W - 85, 195);
    ctx.textAlign = "left"; ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(85, 225); ctx.lineTo(W - 85, 225); ctx.stroke();
    ctx.fillStyle = "#f8fafc"; ctx.roundRect(85, 260, W - 170, 145, 20); ctx.fill();
    ctx.fillStyle = "#166534"; ctx.font = "800 24px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText("কাস্টমার", 110, 300);
    ctx.fillStyle = "#334155"; ctx.font = "600 22px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText(String(order.customer_name || ""), 110, 338); ctx.fillText(String(order.customer_phone || ""), 110, 372); ctx.fillText([order.thana, order.district].filter(Boolean).join(", "), 110, 397);
    ctx.fillStyle = "#17231c"; ctx.font = "900 28px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText("অর্ডারের বিবরণ", 85, 465);
    let y = 515;
    ctx.fillStyle = "#64748b"; ctx.font = "700 19px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText("পণ্য", 85, y); ctx.textAlign = "center"; ctx.fillText("পরিমাণ", 700, y); ctx.textAlign = "right"; ctx.fillText("মূল্য", W - 85, y); ctx.textAlign = "left";
    ctx.strokeStyle = "#e2e8f0"; ctx.beginPath(); ctx.moveTo(85, y + 18); ctx.lineTo(W - 85, y + 18); ctx.stroke(); y += 62;
    for (const item of (order.order_items || [])) {
      const name = String(item.product_name || "");
      ctx.fillStyle = "#334155"; ctx.font = "600 21px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText(name.length > 42 ? name.slice(0, 42) + "…" : name, 85, y);
      ctx.textAlign = "center"; ctx.fillText(bnDigits(item.quantity), 700, y); ctx.textAlign = "right"; ctx.fillText(taka(item.subtotal), W - 85, y); ctx.textAlign = "left";
      ctx.strokeStyle = "#eef2f7"; ctx.beginPath(); ctx.moveTo(85, y + 20); ctx.lineTo(W - 85, y + 20); ctx.stroke(); y += 58;
    }
    y += 35; ctx.fillStyle = "#64748b"; ctx.font = "22px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText("সাবটোটাল", 610, y); ctx.textAlign = "right"; ctx.fillText(taka(order.subtotal), W - 85, y);
    y += 42; ctx.textAlign = "left"; ctx.fillText("ডেলিভারি", 610, y); ctx.textAlign = "right"; ctx.fillText(taka(order.delivery_fee), W - 85, y);
    y += 28; ctx.strokeStyle = "#166534"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(585, y); ctx.lineTo(W - 85, y); ctx.stroke(); y += 48;
    ctx.textAlign = "left"; ctx.fillStyle = "#17231c"; ctx.font = "900 27px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText("সর্বমোট", 610, y); ctx.textAlign = "right"; ctx.fillStyle = "#166534"; ctx.fillText(taka(order.total), W - 85, y);
    ctx.textAlign = "center"; ctx.fillStyle = "#94a3b8"; ctx.font = "18px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText("ধন্যবাদ — Sheikh Seeds-এর সাথে থাকার জন্য 🌱", W / 2, canvas.height - 90);
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Invoice generation failed")), "image/png", 1);
  });
}

function OrderPage() {
  const { id } = useParams({ from: "/order/$id" });
  const fetchOrder = useServerFn(getPublicOrder);
  const { data: order, isLoading } = useQuery({ queryKey: ["order", id], queryFn: () => fetchOrder({ data: { id } }) });

  const downloadInvoice = async () => {
    if (!order) return;
    try {
      toast.loading("ইনভয়েস প্রস্তুত হচ্ছে...", { id: "invoice" });
      const blob = await drawInvoice(order);
      const file = new File([blob], `sheikh-seeds-invoice-${order.id.slice(0, 8)}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ title: "Sheikh Seeds Invoice", files: [file] });
          toast.success("ইনভয়েস গ্যালারিতে সেভ হয়েছে", { id: "invoice", duration: 2200 });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") { toast.dismiss("invoice"); return; }
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = file.name; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success("ইনভয়েস গ্যালারিতে সেভ হয়েছে", { id: "invoice", duration: 2200 });
    } catch (e) {
      toast.error("ইনভয়েস ডাউনলোড করা যায়নি। আবার চেষ্টা করুন।", { id: "invoice" });
    }
  };

  if (isLoading) return <main className="min-h-screen grid place-items-center bg-[#f5faf7]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand/20 border-t-brand" /></main>;
  if (!order) return <main className="min-h-screen grid place-items-center bg-[#f5faf7] px-4 text-center"><div><p className="text-lg font-bold">অর্ডার পাওয়া যায়নি</p><Link to="/shop" className="mt-4 inline-flex rounded-xl bg-brand px-5 py-3 font-bold text-white">শপে ফিরে যান</Link></div></main>;

  return <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#dcfce7_0%,#f7fbf8_32%,#f8faf9_100%)] px-3 py-4 sm:px-5 sm:py-8">
    <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -left-24 top-20 h-52 w-52 animate-pulse rounded-full bg-emerald-300/15 blur-3xl"/><div className="absolute -right-24 top-60 h-64 w-64 animate-pulse rounded-full bg-lime-300/10 blur-3xl [animation-delay:900ms]"/></div>
    <div className="relative mx-auto w-full max-w-xl">
      <section className="animate-[fadeIn_.45s_ease-out] overflow-hidden rounded-[26px] border border-emerald-100/80 bg-white/95 p-5 text-center shadow-[0_18px_60px_rgba(20,83,45,.11)] backdrop-blur sm:p-7">
        <div className="mx-auto flex h-[68px] w-[68px] animate-[pop_.5s_cubic-bezier(.2,.8,.2,1)] items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60"><CheckCircle2 className="h-10 w-10 text-emerald-600" strokeWidth={2.5}/></div>
        <div className="mt-3 text-[10px] font-black uppercase tracking-[.22em] text-emerald-700">ORDER CONFIRMED</div>
        <h1 className="mt-1 text-[25px] font-black tracking-tight text-slate-900 sm:text-3xl">অর্ডার সফল হয়েছে! 🎉</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-slate-500">আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। খুব শীঘ্রই আমাদের টিম আপনার সাথে যোগাযোগ করবে।</p>
        <div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-100">অর্ডার <span className="text-emerald-700">#{order.id.slice(0,8).toUpperCase()}</span><span className="mx-1 h-1 w-1 rounded-full bg-slate-300"/><span className="text-emerald-700">{statusBn[order.status] ?? order.status}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button onClick={downloadInvoice} className="group inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-2 py-3 text-xs font-extrabold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 active:scale-[.98]"><Download className="h-4 w-4 transition group-hover:translate-y-0.5"/> ইনভয়েস ডাউনলোড</button>
          <Link to="/shop" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 py-3 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-[.98]"><ShoppingBag className="h-4 w-4"/> আরও কেনাকাটা</Link>
        </div>
      </section>
      <section className="mt-2.5 animate-[fadeIn_.5s_.08s_both] rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-4.5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1877F2]"><Facebook className="h-5 w-5" fill="currentColor"/></div><div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold text-slate-800">নতুন অফার ও আপডেট পেতে পেইজে থাকুন</h2><p className="mt-0.5 text-[11px] text-slate-500">গার্ডেনিং টিপস, নতুন পণ্য ও বিশেষ অফার সবার আগে।</p></div></div><a href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer" className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] py-2.5 text-xs font-extrabold text-white transition hover:brightness-95 active:scale-[.99]"><Facebook className="h-4 w-4" fill="currentColor"/> ফেইজ ফলো করুন <ArrowRight className="h-3.5 w-3.5"/></a></section>
      <section className="mt-2.5 animate-[fadeIn_.5s_.14s_both] rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-white p-4 shadow-sm sm:p-4.5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><User className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h2 className="text-sm font-extrabold text-slate-800">ফ্রি কাস্টমার অ্যাকাউন্ট তৈরি করুন</h2><Sparkles className="h-3.5 w-3.5 text-amber-500"/></div><p className="mt-1 text-[11px] leading-5 text-slate-500">অর্ডার লাইভ ট্র্যাকিং, আগের অর্ডার দেখা এবং ভবিষ্যতের বিশেষ সুবিধা পেতে এখনই অ্যাকাউন্ট তৈরি করুন।</p></div></div><Link to="/customer-login" className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white shadow-md shadow-emerald-600/15 transition hover:bg-emerald-700 active:scale-[.99]">অ্যাকাউন্ট তৈরি করুন <ArrowRight className="h-3.5 w-3.5"/></Link></section>
      <section className="mt-2.5 animate-[fadeIn_.5s_.2s_both] rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-4.5"><div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><ShoppingBag className="h-4.5 w-4.5"/></div><div><h2 className="text-sm font-extrabold text-slate-800">অর্ডারের বিবরণ</h2><p className="text-[10px] text-slate-400">আপনার অর্ডারের সংক্ষিপ্ত তথ্য</p></div></div><div className="mt-3 divide-y divide-slate-100">{order.order_items?.map((i:any)=><div key={i.id} className="flex items-center justify-between gap-3 py-2 text-xs"><span className="min-w-0 flex-1 font-medium text-slate-700">{i.product_name} <span className="text-slate-400">× {bnDigits(i.quantity)}</span></span><span className="shrink-0 font-extrabold text-slate-800">{taka(i.subtotal)}</span></div>)}</div><div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs"><div className="flex justify-between text-slate-500"><span>সাবটোটাল</span><span>{taka(order.subtotal)}</span></div><div className="flex justify-between text-slate-500"><span>ডেলিভারি</span><span>{taka(order.delivery_fee)}</span></div><div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-black text-slate-900"><span>সর্বমোট</span><span className="text-emerald-700">{taka(order.total)}</span></div></div></section>
      <section className="mt-2.5 animate-[fadeIn_.5s_.26s_both] rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-4.5"><div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-600"><MapPin className="h-4 w-4"/></div><div><h2 className="text-sm font-extrabold text-slate-800">ডেলিভারি তথ্য</h2><p className="text-[10px] text-slate-400">যেখানে অর্ডারটি পৌঁছাবে</p></div></div><div className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2.5 text-xs"><p className="font-bold text-slate-700">{order.customer_name} <span className="font-normal text-slate-400">— {order.customer_phone}</span></p><p className="mt-1 text-slate-500">{[order.thana,order.district].filter(Boolean).join(", ")}</p></div></section>
      <p className="pb-2 pt-4 text-center text-[10px] font-medium text-slate-400">ধন্যবাদ — Sheikh Seeds-এর সাথে থাকার জন্য 🌱</p>
    </div>
    <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes pop{0%{opacity:0;transform:scale(.6)}70%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}`}</style>
  </main>;
}
