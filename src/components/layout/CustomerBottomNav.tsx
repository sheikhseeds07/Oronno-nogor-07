import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Headset, Home, PackageSearch, UserRound, Tag, Phone, MessageCircle, Mail, MapPin, X, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { trackContact } from "@/lib/fbq";

export function CustomerBottomNav({ hidden = false }: { hidden?: boolean }) {
  const { initialized } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 40) setMinimized(false);
        else if (y > lastY + 5) setMinimized(true);
        else if (y < lastY - 7) setMinimized(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!contactOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContactOpen(false); };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [contactOpen]);

  if (!initialized) return null;

  const itemClass = "group relative flex h-[48px] min-w-0 flex-1 flex-col items-center justify-center rounded-[15px] text-slate-600 transition-all duration-300 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 sm:h-[52px]";

  return (
    <>
      <style>{`
        .customer-bottom-nav { transition: transform .5s cubic-bezier(.22,1,.36,1), opacity .35s ease; }
        .customer-bottom-nav::before {
          content:"";
          position:absolute;
          inset:0;
          z-index:0;
          border-radius:22px;
          background:rgba(255,255,255,.985);
          border:1px solid rgba(15,23,42,.07);
          box-shadow:0 18px 48px -18px rgba(15,23,42,.24), 0 6px 18px -10px rgba(22,101,52,.22), inset 0 1px 0 rgba(255,255,255,.95);
        }
        .customer-bottom-nav::after {
          content:"";
          position:absolute;
          left:14%;
          right:14%;
          top:0;
          height:1px;
          border-radius:999px;
          background:linear-gradient(90deg,transparent,rgba(16,185,129,.38),rgba(132,204,22,.34),transparent);
          z-index:2;
        }
        .customer-bottom-nav > div { z-index:1; }
        .customer-bottom-nav.is-minimized { transform: translateY(2px); }
        .customer-bottom-nav.is-minimized::before { box-shadow:0 12px 34px -16px rgba(15,23,42,.22), 0 5px 16px -10px rgba(22,101,52,.18); }
        .customer-bottom-nav.is-hidden { transform: translateY(150%); opacity: 0; pointer-events:none; }
        .customer-nav-icon { transition: transform .45s cubic-bezier(.22,1,.36,1), opacity .35s ease, height .45s ease, margin .45s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-icon { transform: scale(.12); opacity:0; height:2px; margin-bottom:-2px; }
        .customer-nav-label { transition: transform .45s cubic-bezier(.22,1,.36,1), color .25s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-label { transform: translateY(1px) scale(1.03); color:#166534; }
        .customer-nav-home { transition: transform .45s cubic-bezier(.22,1,.36,1), box-shadow .45s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-home { transform: translateY(1px) scale(.76); }
        .customer-nav-live { animation: navPulse 2.7s ease-in-out infinite; }
        .customer-nav-shine { animation: navShine 4.2s ease-in-out infinite; }
        .customer-nav-dot { animation: navDot 1.8s ease-in-out infinite; }
        .contact-modal-card { animation: contactIn .34s cubic-bezier(.22,1,.36,1); }
        .contact-modal-backdrop { animation: backdropIn .22s ease-out; }
        .contact-glow { animation: contactGlow 3.2s ease-in-out infinite; }
        @keyframes contactIn { from{opacity:0;transform:translateY(14px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes backdropIn { from{opacity:0} to{opacity:1} }
        @keyframes contactGlow { 0%,100%{transform:scale(.95);opacity:.4} 50%{transform:scale(1.08);opacity:.7} }
        @keyframes navPulse { 0%,100%{box-shadow:0 8px 20px rgba(22,101,52,.26),0 0 0 0 rgba(74,222,128,.16)} 50%{box-shadow:0 11px 25px rgba(22,101,52,.34),0 0 0 5px rgba(74,222,128,0)} }
        @keyframes navShine { 0%,60%,100%{transform:translateX(-150%);opacity:0} 70%{opacity:.4} 84%{transform:translateX(180%);opacity:0} }
        @keyframes navDot { 0%,100%{transform:scale(.8);opacity:.65} 50%{transform:scale(1.25);opacity:1} }
        @media (prefers-reduced-motion: reduce) { .customer-bottom-nav,.customer-nav-icon,.customer-nav-label,.customer-nav-home,.customer-nav-live,.customer-nav-shine,.customer-nav-dot,.contact-modal-card,.contact-modal-backdrop,.contact-glow{animation:none!important;transition:none!important} }
      `}</style>

      <nav aria-label="কাস্টমার নেভিগেশন" aria-hidden={hidden} className={`customer-bottom-nav fixed inset-x-2 bottom-[max(7px,env(safe-area-inset-bottom))] z-[30] mx-auto max-w-[500px] rounded-[22px] p-1.5 sm:inset-x-3 sm:bottom-3 sm:p-2 ${minimized ? "is-minimized" : ""} ${hidden ? "is-hidden" : ""}`}>
        <div className="relative flex items-center gap-0.5 sm:gap-1">
          <Link to="/shop" className={itemClass}><span className="customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_white,0_2px_5px_rgba(16,185,129,.10)] group-hover:bg-emerald-100"><PackageSearch className="h-[17px] w-[17px]" strokeWidth={2.35} /></span><span className="customer-nav-label mt-1 text-[8.5px] font-black leading-none sm:text-[9px]">সকল পণ্য</span></Link>
          <Link to="/offers" className={itemClass}><span className="relative customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600 shadow-[inset_0_1px_0_white,0_2px_5px_rgba(245,158,11,.10)] group-hover:bg-amber-100"><Tag className="h-[17px] w-[17px]" strokeWidth={2.35} /><span className="customer-nav-dot absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" /></span><span className="customer-nav-label mt-1 text-[8.5px] font-black leading-none sm:text-[9px]">অফার</span></Link>
          <Link to="/" activeOptions={{ exact: true }} className="group relative z-10 flex h-[54px] w-[64px] shrink-0 flex-col items-center justify-center text-emerald-800 transition-all duration-300 active:scale-95 sm:h-[58px] sm:w-[70px]"><span className="customer-nav-home customer-nav-live relative -mt-1 flex h-[46px] w-[46px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#064e3b] via-[#15803d] to-[#84cc16] text-white shadow-[0_10px_26px_-7px_rgba(22,101,52,.62)]"><span className="customer-nav-shine absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-22deg] bg-white/40 blur-md" /><span className="absolute inset-1 rounded-full border border-white/15" /><Home className="relative h-[21px] w-[21px] drop-shadow-md sm:h-[22px] sm:w-[22px]" strokeWidth={2.5} /></span><span className="customer-nav-label mt-0.5 text-[8.5px] font-black text-emerald-900 sm:text-[9px]">হোম</span></Link>
          <button type="button" onClick={() => setContactOpen(true)} className={itemClass}><span className="customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_white,0_2px_5px_rgba(16,185,129,.10)] group-hover:bg-emerald-100"><Headset className="h-[17px] w-[17px]" strokeWidth={2.35} /></span><span className="customer-nav-label mt-1 text-[8.5px] font-black leading-none sm:text-[9px]">যোগাযোগ</span></button>
          <Link to="/profile" className={itemClass}><span className="customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_white,0_2px_5px_rgba(16,185,129,.10)] group-hover:bg-emerald-100"><UserRound className="h-[17px] w-[17px]" strokeWidth={2.35} /></span><span className="customer-nav-label mt-1 text-[8.5px] font-black leading-none sm:text-[9px]">অ্যাকাউন্ট</span></Link>
        </div>
      </nav>

      {contactOpen && (<div className="contact-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md" onClick={() => setContactOpen(false)}><div role="dialog" aria-modal="true" aria-label="যোগাযোগ করুন" onClick={(e) => e.stopPropagation()} className="contact-modal-card relative z-[10000] w-full max-w-[390px] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_35px_100px_rgba(0,0,0,.34)]"><div className="relative overflow-hidden bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#65a30d] px-5 pb-5 pt-5 text-white"><div className="contact-glow absolute -right-12 -top-14 h-40 w-40 rounded-full bg-lime-200/20 blur-3xl" /><div className="absolute bottom-0 left-1/3 h-20 w-36 rounded-full bg-white/10 blur-3xl" /><button type="button" aria-label="বন্ধ করুন" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setContactOpen(false); }} className="absolute right-3 top-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 shadow-lg transition-all hover:rotate-90 hover:bg-white/25 active:scale-90"><X className="h-4 w-4" strokeWidth={2.5} /></button><div className="relative flex items-center gap-3 pr-8"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white/15 ring-1 ring-white/25 shadow-lg"><Headset className="h-5 w-5" /></div><div><div className="mb-0.5 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.18em] text-lime-200"><Sparkles className="h-3 w-3" /> Customer Care</div><h3 className="text-[18px] font-black tracking-tight">কীভাবে সাহায্য করতে পারি?</h3><p className="mt-0.5 text-[10px] text-white/75">আপনার সুবিধামতো যেকোনো মাধ্যমে যোগাযোগ করুন</p></div></div></div><div className="grid grid-cols-2 gap-2.5 p-3.5"><a href="tel:+8809644553383" onClick={() => trackContact({ method: "phone" })} className="group rounded-[18px] border border-slate-200/90 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Phone className="h-[18px] w-[18px]" /></div><div className="mt-2 text-[13px] font-black">কল করুন</div><div className="text-[10px] text-slate-500">09644-553383</div></a><a href="https://wa.me/8809644553383" target="_blank" rel="noreferrer" onClick={() => trackContact({ method: "whatsapp" })} className="group rounded-[18px] border border-slate-200/90 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-lg"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-600"><MessageCircle className="h-[18px] w-[18px]" /></div><div className="mt-2 text-[13px] font-black">WhatsApp</div><div className="text-[10px] text-slate-500">২৪/৭ মেসেজ</div></a><a href="mailto:info@sheikhseeds.com" onClick={() => trackContact({ method: "email" })} className="group rounded-[18px] border border-slate-200/90 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Mail className="h-[18px] w-[18px]" /></div><div className="mt-2 text-[13px] font-black">ইমেইল</div><div className="text-[10px] text-slate-500">info@sheikhseeds.com</div></a><div className="rounded-[18px] border border-slate-200/90 bg-slate-50/70 p-3.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><MapPin className="h-[18px] w-[18px]" /></div><div className="mt-2 text-[13px] font-black">অফিস</div><div className="text-[10px] text-slate-500">গোপালগঞ্জ সদর, পাবলিক হল রোড</div></div></div><div className="border-t border-slate-100 px-4 py-3 text-center text-[9px] font-bold text-slate-400">আমরা আপনার সেবায় প্রস্তুত • দ্রুত সহায়তার জন্য কল করুন</div></div></div>)}
    </>
  );
}
