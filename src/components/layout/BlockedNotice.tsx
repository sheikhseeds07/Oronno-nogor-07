import { ShieldAlert, PhoneCall } from "lucide-react";

/** Premium full-screen notice shown to blocked visitors (IP, device or account). */
export function BlockedNotice() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 animate-pulse rounded-full bg-red-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 animate-pulse rounded-full bg-rose-500/20 blur-3xl" />
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-8 text-center shadow-[0_25px_80px_rgba(0,0,0,.55)] backdrop-blur-2xl">
          <span className="relative mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-900/40">
            <span className="absolute inset-0 animate-ping rounded-3xl bg-red-500/30" />
            <ShieldAlert className="relative h-9 w-9" />
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white">আপনাকে ব্লক করা হয়েছে</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            দুঃখিত, এই ডিভাইস থেকে আমাদের ওয়েবসাইটে প্রবেশ বন্ধ করা হয়েছে। কোনো ভুল হয়ে থাকলে অনুগ্রহ করে
            আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।
          </p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs font-semibold text-slate-400">
            অ্যাক্সেস স্ট্যাটাস: <span className="font-black text-red-400">Blocked</span>
          </div>
          <a
            href="tel:+8801601916100"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 py-3.5 text-sm font-black text-white shadow-lg shadow-red-900/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
          >
            <PhoneCall className="h-4 w-4" /> সাপোর্টে কল করুন
          </a>
        </div>
      </div>
    </div>
  );
}
