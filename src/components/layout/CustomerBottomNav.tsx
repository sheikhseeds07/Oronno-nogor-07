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

  const itemClass = "group relative flex h-[50px] min-w-0 flex-1 flex-col items-center justify-center rounded-[16px] text-slate-500 transition-all duration-300 hover:bg-emerald-50/90 hover:text-emerald-700 active:scale-95 sm:h-[55px]";

  return (
    <>
      <style>{`
        .customer-bottom-nav { transition: transform .5s cubic-bezier(.22,1,.36,1), opacity .35s ease; }
        .customer-bottom-nav::before {
          content:"";
          position:absolute;
          inset:0;
          z-index:-1;
          border:1px solid rgba(255,255,255,.92);
          border-radius:23px;
          background:rgba(255,255,255,.96);
          box-shadow:0 18px 55px -24px rgba(15,70,40,.52);
          -webkit-mask:radial-gradient(circle 38px at 50% 0, transparent 0 37px, #000 38px);
          mask:radial-gradient(circle 38px at 50% 0, transparent 0 37px, #000 38px);
        }
        .customer-bottom-nav.is-minimized { transform: translateY(3px); }
        .customer-bottom-nav.is-minimized::before { box-shadow:0 12px 38px -18px rgba(15,70,40,.45); }
        .customer-bottom-nav.is-hidden { transform: translateY(150%); opacity: 0; pointer-events:none; }
        .customer-nav-icon { transition: transform .45s cubic-bezier(.22,1,.36,1), opacity .35s ease, height .45s ease, margin .45s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-icon { transform: scale(.12); opacity:0; height:2px; margin-bottom:-2px; }
        .customer-nav-label { transition: transform .45s cubic-bezier(.22,1,.36,1), color .25s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-label { transform: translateY(1px) scale(1.03); color:#166534; }
        .customer-nav-home { transition: transform .45s cubic-bezier(.22,1,.36,1), box-shadow .45s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-home { transform: translateY(2px) scale(.72); }
        .customer-nav-live { animation: navPulse 2.7s ease-in-out infinite; }
        .customer-nav-shine { animation: navShine 4.2s ease-in-out infinite; }
        .customer-nav-dot { animation: navDot 1.8s ease-in-out infinite; }
        .contact-modal-card { animation: contactIn .34s cubic-bezier(.22,1,.36,1); }
        .contact-modal-backdrop { animation: backdropIn .22s ease-out; }
        .contact-glow { animation: contactGlow 3.2s ease-in-out infinite; }
        @keyframes contactIn { from{opacity:0;transform:translateY(14px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes backdropIn { from{opacity:0} to{opacity:1} }
        @keyframes contactGlow { 0%,100%{transform:scale(.95);opacity:.4} 50%{transform:scale(1.08);opacity:.7} }
        @keyframes navPulse { 0%,100%{box-shadow:0 9px 22px rgba(22,101,52,.25),0 0 0 0 rgba(74,222,128,.22)} 50%{box-shadow:0 13px 28px rgba(22,101,52,.35),0 0 0 6px rgba(74,222,128,0)} }
        @keyframes navShine { 0%,60%,100%{transform:translateX(-150%);opacity:0} 70%{opacity:.4} 84%{transform:translateX(180%);opacity:0} }
        @keyframes navDot { 0%,100%{transform:scale(.8);opacity:.65} 50%{transform:scale(1.25);opacity:1} }
        @media (prefers-reduced-motion: reduce) { .customer-bottom-nav,.customer-nav-icon,.customer-nav-label,.customer-nav-home,.customer-nav-live,.customer-nav-shine,.customer-nav-dot,.contact-modal-card,.contact-modal-backdrop,.contact-glow{animation:none!important;transition:none!important} }
      `}</style>

      <nav aria-label="কাস্টমার নেভিগেশন" aria-hidden={hidden} className={`customer-bottom-nav fixed inset-x-2 bottom-[max(7px,env(safe-area-inset-bottom))] z-[30] mx-auto max-w-[540px] rounded-[23px] p-1 sm:inset-x-3 sm:bottom-3 sm:rounded-[26px] sm:p-1.5 ${minimized ? "is-minimized" : ""} ${hidden ? "is-hidden" : ""}`}>
        <div className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent" />
        <div className="relative flex items-center gap-0.5 sm:gap-1">
          <Link to="/shop" className={itemClass}>
            <span className="customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_white] group-hover:bg-emerald-100"><PackageSearch className="h-[17px] w-[17px]" strokeWidth={2.25} /></span>
            <span className="customer-nav-label mt-1 text-[9px] font-black leading-none sm:text-[10px]">সকল পণ্য</span>
          </Link>
          <Link to="/offers" className={itemClass}>
            <span className="relative customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600 shadow-[inset_0_1px_0_white] group-hover:bg-amber-100"><Tag className="h-[17px] w-[17px]" strokeWidth={2.25} /><span className="customer-nav-dot absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" /></span>
            <span className="customer-nav-label mt-1 text-[9px] font-black leading-none sm:text-[10px]">অফার</span>
          </Link>
          <Link to="/" activeOptions={{ exact: true }} className="group relative z-10 flex h-[58px] w-[72px] shrink-0 flex-col items-center justify-center rounded-[20px] text-emerald-800 transition-all duration-300 active:scale-95 sm:h-[62px] sm:w-[80px]">
            <span className="customer-nav-home customer-nav-live relative -mt-5 flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-gradient-to-br from-[#064e3b] via-[#15803d] to-[#84cc16] text-white ring-1 ring-emerald-300/90 shadow-[0_10px_28px_-8px_rgba(22,101,52,.7)]">
              <span className="customer-nav-shine absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-22deg] bg-white/40 blur-md" />
              <span className="absolute inset-1 rounded-full border border-white/15" />
              <Home className="relative h-[23px] w-[23px] drop-shadow-md sm:h-[25px] sm:w-[25px]" strokeWidth={2.5} />
            </span>
            <span className="customer-nav-label absolute bottom-0 text-[9px] font-black text-emerald-900 sm:text-[10px]">হোম</span>
          </Link>
          <button type="button" onClick={() => setContactOpen(true)} className={itemClass}>
            <span className="customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_white] group-hover:bg-emerald-100"><Headset className="h-[17px] w-[17px]" strokeWidth={2.25} /></span>
            <span className="customer-nav-label mt-1 text-[9px] font-black leading-none sm:text-[10px]">যোগাযোগ</span>
          </button>
          <Link to="/profile" className={itemClass}>
            <span className="customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_white] group-hover:bg-emerald-100"><UserRound className="h-[17px] w-[17px]" strokeWidth={2.25} /></span>
            <span className="customer-nav-label mt-1 text-[9px] font-black leading-none sm:text-[10px]">অ্যাকাউন্ট</span>
          </Link>
        </div>
      </nav>

      {contactOpen && (
        <div className="contact-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md" onClick={() => setContactOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="যোগাযোগ করুন" onClick={(e) => e.stopPropagation()} className="contact-modal-card relative z-[10000] w-full max-w-[390px] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_35px_100px_rgba(0,0,0,.34)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#65a30d] px-5 pb-5 pt-5 text-white">
              <div className="contact-glow absolute -right-12 -top-14 h-40 w-40 rounded-full bg-lime-200/20 blur-3xl" />
              <div className="absolute bottom-0 left-1/3 h-20 w-36 rounded-full bg-white/10 blur-3xl" />
              <button type="button" aria-label="বন্ধ করুন" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setContactOpen(false); }} className="absolute right-3 top-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 shadow-lg transition-all hover:rotate-90 hover:bg-white/25 active:scale-90"><X className="h-4 w-4" strokeWidth={2.5} /></button>
              <div className="relative flex items-center gap-3 pr-8"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white/15 ring-1 ring-white/25 shadow-lg"><Headset className="h-5 w-5" /></div><div><div className="mb-0.5 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.18em] text-lime-200"><Sparkles className="h-3 w-3" /> Customer Care</div><h3 className="text-[18px] font-black tracking-tight">কীভাবে সাহায্য করতে পারি?</h3><p className="mt-0.5 text-[10px] text-white/75">আপনার সুবিধামতো যেকোনো মাধ্যমে যোগাযোগ করুন</p></div></div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 p-3.5">
              <a href="tel:+8809644553383" onClick={() => trackContact({ method: "phone" })} className="group rounded-[18px] border border-slate-200/90 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Phone className="h-[18px] w-[18px]" /></div><div className="mt-2 text-[13px] font-black">কল করুন</div><div className="text-[10px] text-slate-500">09644-553383</div></a>
              <a href="https://wa.me/8809644553383" target="_blank" rel="noreferrer" onClick={() => trackContact({ method: "whatsapp" })} className="group rounded-[18px] border border-slate-200/90 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-lg"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-600"><MessageCircle className="h-[18px] w-[18px]" /></div><div className="mt-2 text-[13px] font-black">WhatsApp</div><div className="text-[10px] text-slate-500">২৪/৭ মেসেজ</div></a>
              <a href="mailto:info@sheikhseeds.com" onClick={() => trackContact({ method: "email" })} className="group rounded-[18px] border border-slate-200/90 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Mail className="h-[18px] w-[18px]" /></div><div className="mt-2 text-[13px] font-black">ইমেইল</div><div className="text-[10px] text-slate-500">info@sheikhseeds.com</div></a>
              <div className="rounded-[18px] border border-slate-200/90 bg-slate-50/70 p-3.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><MapPin className="h-[18px] w-[18px]" /></div><div className="mt-2 text-[13px] font-black">অফিস</div><div className="text-[10px] text-slate-500">গোপালগঞ্জ সদর, পাবলিক হল রোড</div></div>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-center text-[9px] font-bold text-slate-400">আমরা আপনার সেবায় প্রস্তুত • দ্রুত সহায়তার জন্য কল করুন</div>
          </div>
        </div>
      )}
    </>
  );
}
