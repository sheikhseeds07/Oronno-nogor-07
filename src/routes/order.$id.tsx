import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getPublicOrder } from "@/lib/public-order.functions";
import { taka, bnDigits } from "@/lib/format";
import { CheckCircle2, Facebook, Download, ShoppingBag, User, ArrowRight, Sparkles, MapPin, X, Share2, Smartphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/order/$id")({ component: OrderPage, head: () => ({ meta: [{ title: "অর্ডার সফল — Sheikh Seeds" }, { name: "robots", content: "noindex, nofollow" }] }) });

const statusBn: Record<string, string> = { web_pending: "ওয়েব পেন্ডিং", pending: "অপেক্ষমাণ", confirmed: "কনফার্মড", processing: "প্রস্তুত হচ্ছে", rts: "RTS", shipped: "ডেলিভারিতে", delivered: "ডেলিভারি সম্পন্ন", cancelled: "বাতিল", returned: "ফেরত", hold: "হোল্ড" };
const FACEBOOK_PAGE_URL = "https://www.facebook.com/share/1DoMWrXv2i/";

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y); ctx.arcTo(x + w, y, x + w, y + radius, radius); ctx.lineTo(x + w, y + h - radius); ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius); ctx.lineTo(x + radius, y + h); ctx.arcTo(x, y + h, x, y + h - radius, radius); ctx.lineTo(x, y + radius); ctx.arcTo(x, y, x + radius, y, radius); ctx.closePath();
}

function drawInvoice(order: any): HTMLCanvasElement {
  const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 1380;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Invoice canvas unavailable"); const W = canvas.width;
  ctx.fillStyle = "#f3f8f5"; ctx.fillRect(0, 0, W, canvas.height); ctx.fillStyle = "#fff"; roundedRect(ctx,45,45,W-90,canvas.height-90,30); ctx.fill();
  ctx.fillStyle="#166534"; ctx.font="900 46px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText("Sheikh Seeds",85,125); ctx.fillStyle="#64748b"; ctx.font="24px Arial, 'Noto Sans Bengali', sans-serif"; ctx.fillText("অরিজিনাল বীজ ও গার্ডেন পণ্য",85,165);
  const no=`#${order.id.slice(0,8).toUpperCase()}`; ctx.textAlign="right"; ctx.fillStyle="#17231c"; ctx.font="900 28px Arial,sans-serif"; ctx.fillText("INVOICE",W-85,120); ctx.font="700 25px Arial,sans-serif"; ctx.fillText(no,W-85,160); ctx.fillStyle="#64748b"; ctx.font="20px Arial,sans-serif"; ctx.fillText(new Date(order.created_at).toLocaleDateString("bn-BD"),W-85,195);
  ctx.textAlign="left"; ctx.strokeStyle="#e2e8f0"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(85,225); ctx.lineTo(W-85,225); ctx.stroke(); ctx.fillStyle="#f8fafc"; roundedRect(ctx,85,260,W-170,145,20); ctx.fill();
  ctx.fillStyle="#166534"; ctx.font="800 24px Arial,'Noto Sans Bengali',sans-serif"; ctx.fillText("কাস্টমার",110,300); ctx.fillStyle="#334155"; ctx.font="600 22px Arial,'Noto Sans Bengali',sans-serif"; ctx.fillText(String(order.customer_name||""),110,338); ctx.fillText(String(order.customer_phone||""),110,372); ctx.fillText([order.thana,order.district].filter(Boolean).join(", "),110,397);
  ctx.fillStyle="#17231c"; ctx.font="900 28px Arial,'Noto Sans Bengali',sans-serif"; ctx.fillText("অর্ডারের বিবরণ",85,465); let y=515; ctx.fillStyle="#64748b"; ctx.font="700 19px Arial,'Noto Sans Bengali',sans-serif"; ctx.fillText("পণ্য",85,y); ctx.textAlign="center"; ctx.fillText("পরিমাণ",700,y); ctx.textAlign="right"; ctx.fillText("মূল্য",W-85,y); ctx.textAlign="left"; ctx.strokeStyle="#e2e8f0"; ctx.beginPath(); ctx.moveTo(85,y+18); ctx.lineTo(W-85,y+18); ctx.stroke(); y+=62;
  for(const item of(order.order_items||[])){const name=String(item.product_name||""); ctx.fillStyle="#334155"; ctx.font="600 21px Arial,'Noto Sans Bengali',sans-serif"; ctx.fillText(name.length>42?name.slice(0,42)+"…":name,85,y); ctx.textAlign="center"; ctx.fillText(bnDigits(item.quantity),700,y); ctx.textAlign="right"; ctx.fillText(taka(item.subtotal),W-85,y); ctx.textAlign="left"; ctx.strokeStyle="#eef2f7"; ctx.beginPath(); ctx.moveTo(85,y+20); ctx.lineTo(W-85,y+20); ctx.stroke(); y+=58;}
  y+=35; ctx.fillStyle="#64748b"; ctx.font="22px Arial,'Noto Sans Bengali',sans-serif"; ctx.fillText("সাবটোটাল",610,y); ctx.textAlign="right"; ctx.fillText(taka(order.subtotal),W-85,y); y+=42; ctx.textAlign="left"; ctx.fillText("ডেলিভারি",610,y); ctx.textAlign="right"; ctx.fillText(taka(order.delivery_fee),W-85,y); y+=28; ctx.strokeStyle="#166534"; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(585,y); ctx.lineTo(W-85,y); ctx.stroke(); y+=48; ctx.textAlign="left"; ctx.fillStyle="#17231c"; ctx.font="900 27px Arial,'Noto Sans Bengali',sans-serif"; ctx.fillText("সর্বমোট",610,y); ctx.textAlign="right"; ctx.fillStyle="#166534"; ctx.fillText(taka(order.total),W-85,y); ctx.textAlign="center"; ctx.fillStyle="#94a3b8"; ctx.font="18px Arial,'Noto Sans Bengali',sans-serif"; ctx.fillText("ধন্যবাদ — Sheikh Seeds-এর সাথে থাকার জন্য 🌱",W/2,canvas.height-90);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> { return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Invoice image generation failed")),type,0.98)); }

function isAndroid(): boolean { return /Android/i.test(navigator.userAgent); }
function isFacebookInAppBrowser(): boolean { return /FBAN|FBAV|FB_IAB|FB4A|FB4B/i.test(navigator.userAgent); }

async function shareInvoiceFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png", lastModified: Date.now() });
  if (typeof navigator.share !== "function") return false;
  const canShareFiles = typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });
  if (!canShareFiles) return false;
  try {
    await navigator.share({ title: "Sheikh Seeds Invoice", text: "আপনার Sheikh Seeds ইনভয়েস", files: [file] });
    return true;
  } catch (error: any) {
    if (error?.name === "AbortError") return true;
    console.warn("Invoice share failed", error);
    return false;
  }
}

async function saveBlobToDevice(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type || "image/png", lastModified: Date.now() });
  if (isFacebookInAppBrowser() && typeof navigator.share === "function") {
    const canShareFiles = typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });
    if (canShareFiles) {
      try {
        await navigator.share({ title: "Sheikh Seeds Invoice", text: "আপনার Sheikh Seeds ইনভয়েস", files: [file] });
        return "shared" as const;
      } catch (error: any) {
        if (error?.name === "AbortError") return "cancelled" as const;
        console.warn("Facebook in-app invoice share failed", error);
      }
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const saveWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (saveWindow) return "opened" as const;
    const a = document.createElement("a"); a.href = url; a.download = filename; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    return "downloaded" as const;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

function OrderPage() {
  const { id } = useParams({ from: "/order/$id" }); const fetchOrder = useServerFn(getPublicOrder); const { data: order, isLoading } = useQuery({ queryKey:["order",id], queryFn:()=>fetchOrder({data:{id}}) });
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null);
  const [invoiceBlob, setInvoiceBlob] = useState<Blob | null>(null);
  const [invoiceFilename, setInvoiceFilename] = useState("sheikh-seeds-invoice.png");

  useEffect(() => () => { if(invoicePreviewUrl) URL.revokeObjectURL(invoicePreviewUrl); }, [invoicePreviewUrl]);

  const downloadInvoice = async () => {
    if(!order)return;
    try {
      toast.loading("ইনভয়েস প্রস্তুত হচ্ছে...",{id:"invoice"});
      const canvas=drawInvoice(order); const blob=await canvasToBlob(canvas,"image/png"); const filename=`sheikh-seeds-invoice-${order.id.slice(0,8)}.png`;
      if(invoicePreviewUrl) URL.revokeObjectURL(invoicePreviewUrl);
      setInvoiceBlob(blob); setInvoiceFilename(filename); setInvoicePreviewUrl(URL.createObjectURL(blob));
      toast.success("ইনভয়েস প্রস্তুত — নিচের বাটন থেকে মোবাইলে সেভ করুন",{id:"invoice",duration:3500});
    } catch(e:any) {
      console.error("Invoice preparation failed",e); toast.error("ইনভয়েস প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।",{id:"invoice",duration:3500});
    }
  };

  const saveInvoice = async () => {
    if(!invoiceBlob)return;
    try {
      const result = await saveBlobToDevice(invoiceBlob, invoiceFilename);
      if(result === "cancelled") { toast.dismiss("invoice"); return; }
      if(result === "shared") { toast.success("ইনভয়েস সেভ করার জন্য ফোনের অপশন চালু হয়েছে", { duration: 4000 }); return; }
      if(result === "opened") { toast.success(isAndroid() ? "ইনভয়েস ওপেন হয়েছে — ছবিটি চেপে ধরে Save/Download করুন" : "ইনভয়েস ওপেন হয়েছে", { duration: 4500 }); return; }
      toast.success(isAndroid() ? "ইনভয়েস ডাউনলোড শুরু হয়েছে — Downloads/Files-এ পাবেন" : "ইনভয়েস ডাউনলোড শুরু হয়েছে", { duration: 3500 });
    } catch(e:any) {
      if(e?.name === "AbortError") { toast.dismiss("invoice"); return; }
      console.error("Invoice save failed",e); toast.error("ইনভয়েস সেভ করা যায়নি। আবার চেষ্টা করুন।",{duration:3500});
    }
  };

  const shareInvoice = async () => {
    if(!invoiceBlob)return;
    const shared = await shareInvoiceFile(invoiceBlob, invoiceFilename);
    if(shared) toast.success("সেভ/শেয়ার অপশন চালু হয়েছে — Photos/Gallery বেছে নিন", { duration: 4000 });
    else toast.info("এই ব্রাউজারে Share সাপোর্ট নেই। ‘মোবাইলে সেভ করুন’ বাটন ব্যবহার করুন।", { duration: 4000 });
  };

  if(isLoading)return <main className="min-h-screen grid place-items-center bg-[#f5faf7]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand/20 border-t-brand"/></main>;
  if(!order)return <main className="min-h-screen grid place-items-center bg-[#f5faf7] px-4 text-center"><div><p className="text-lg font-bold">অর্ডার পাওয়া যায়নি</p><Link to="/shop" className="mt-4 inline-flex rounded-xl bg-brand px-5 py-3 font-bold text-white">শপে ফিরে যান</Link></div></main>;
  return <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#dcfce7_0%,#f7fbf8_32%,#f8faf9_100%)] px-3 py-4 sm:px-5 sm:py-8"><div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -left-24 top-20 h-52 w-52 animate-pulse rounded-full bg-emerald-300/15 blur-3xl"/><div className="absolute -right-24 top-60 h-64 w-64 animate-pulse rounded-full bg-lime-300/10 blur-3xl [animation-delay:900ms]"/></div><div className="relative mx-auto w-full max-w-xl">
  <section className="animate-[fadeIn_.45s_ease-out] overflow-hidden rounded-[26px] border border-emerald-100/80 bg-white/95 p-5 text-center shadow-[0_18px_60px_rgba(20,83,45,.11)] backdrop-blur sm:p-7"><div className="mx-auto flex h-[68px] w-[68px] animate-[pop_.5s_cubic-bezier(.2,.8,.2,1)] items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60"><CheckCircle2 className="h-10 w-10 text-emerald-600" strokeWidth={2.5}/></div><div className="mt-3 text-[10px] font-black uppercase tracking-[.22em] text-emerald-700">ORDER CONFIRMED</div><h1 className="mt-1 text-[25px] font-black tracking-tight text-slate-900 sm:text-3xl">অর্ডার সফল হয়েছে! 🎉</h1><p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-slate-500">আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। খুব শীঘ্রই আমাদের টিম আপনার সাথে যোগাযোগ করবে।</p><div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-100">অর্ডার <span className="text-emerald-700">#{order.id.slice(0,8).toUpperCase()}</span><span className="mx-1 h-1 w-1 rounded-full bg-slate-300"/><span className="text-emerald-700">{statusBn[order.status]??order.status}</span></div><div className="mt-4 grid grid-cols-2 gap-2.5"><button onClick={downloadInvoice} className="group inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-2 py-3 text-xs font-extrabold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 active:scale-[.98]"><Download className="h-4 w-4 transition group-hover:translate-y-0.5"/> ইনভয়েস ডাউনলোড</button><Link to="/shop" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 py-3 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-[.99]"><ShoppingBag className="h-4 w-4"/> আরও কেনাকাটা</Link></div></section>
  <section className="mt-2.5 animate-[fadeIn_.5s_.08s_both] rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-4.5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1877F2]"><Facebook className="h-5 w-5" fill="currentColor"/></div><div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold text-slate-800">নতুন অফার ও আপডেট পেতে পেইজে থাকুন</h2><p className="mt-0.5 text-[11px] text-slate-500">গার্ডেনিং টিপস, নতুন পণ্য ও বিশেষ অফার সবার আগে।</p></div></div><a href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer" className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] py-2.5 text-xs font-extrabold text-white transition hover:brightness-95 active:scale-[.99]"><Facebook className="h-4 w-4" fill="currentColor"/> ফেইজ ফলো করুন <ArrowRight className="h-3.5 w-3.5"/></a></section>
  <section className="mt-2.5 animate-[fadeIn_.5s_.14s_both] rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-white p-4 shadow-sm sm:p-4.5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><User className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h2 className="text-sm font-extrabold text-slate-800">ফ্রি কাস্টমার অ্যাকাউন্ট তৈরি করুন</h2><Sparkles className="h-3.5 w-3.5 text-amber-500"/></div><p className="mt-0.5 text-[11px] leading-5 text-slate-500">অর্ডার ট্র্যাকিং, বোনাস, গিফট এবং কৃষি কমিউনিটির টিপস পেতে এখনই অ্যাকাউন্ট তৈরি করুন।</p><Link to="/customer-login" className="mt-2.5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-emerald-600/15 transition hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-[.99]">অ্যাকাউন্ট তৈরি করুন <ArrowRight className="h-3.5 w-3.5"/></Link></div></div></section>
  <section className="mt-2.5 grid gap-2.5 sm:grid-cols-2"><div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-emerald-700"><ShoppingBag className="h-4 w-4"/><span className="text-xs font-black">অর্ডারের তথ্য</span></div><div className="mt-2 space-y-1 text-[11px] text-slate-600"><div className="flex justify-between gap-3"><span>সাবটোটাল</span><b>{taka(order.subtotal)}</b></div><div className="flex justify-between gap-3"><span>ডেলিভারি</span><b>{taka(order.delivery_fee)}</b></div><div className="flex justify-between gap-3 border-t border-slate-100 pt-1.5 text-slate-900"><span className="font-extrabold">সর্বমোট</span><b className="text-emerald-700">{taka(order.total)}</b></div></div></div><div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-emerald-700"><MapPin className="h-4 w-4"/><span className="text-xs font-black">ডেলিভারি তথ্য</span></div><div className="mt-2 text-[11px] leading-5 text-slate-600"><b className="text-slate-800">{order.customer_name}</b><br/>{order.customer_phone}<br/>{[order.address,order.thana,order.district].filter(Boolean).join(", ")}</div></div></section>
</div>
{invoicePreviewUrl && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:items-center sm:p-5"><div className="flex max-h-[94vh] w-full max-w-lg animate-[fadeIn_.2s_ease-out] flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl ring-1 ring-white/20"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5"><div><p className="text-sm font-black text-slate-900">ইনভয়েস প্রস্তুত ✅</p><p className="mt-0.5 text-[10px] text-slate-500">নিচের বাটনে চাপ দিয়ে ফোনে সেভ করুন</p></div><button onClick={()=>setInvoicePreviewUrl(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"><X className="h-4 w-4"/></button></div><div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-2.5 sm:p-4"><img src={invoicePreviewUrl} alt="Sheikh Seeds invoice" className="mx-auto h-auto w-full max-w-[430px] rounded-xl bg-white shadow-md" /></div><div className="border-t border-slate-100 bg-white p-3 sm:p-4"><button onClick={saveInvoice} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[.99]"><Smartphone className="h-5 w-5"/> মোবাইলে সেভ করুন</button><button onClick={shareInvoice} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-extrabold text-emerald-800 transition hover:bg-emerald-100 active:scale-[.99]"><Share2 className="h-4 w-4"/> গ্যালারি/Photos-এ সেভ বা শেয়ার</button><p className="mt-2 text-center text-[10px] leading-4 text-slate-400">গ্যালারিতে সরাসরি সেভ করা ব্রাউজারভেদে সীমাবদ্ধ হতে পারে। Share বাটনে Photos/Gallery বেছে নিলে সেখানে সেভ করা যাবে।</p></div></div></div>}
</main>;
}
export default OrderPage;
