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

  if (!initialized) return null;

  const itemClass = "group relative flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center rounded-[18px] text-slate-500 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 sm:h-[60px]";

  return (
    <>
      <style>{`
        .customer-bottom-nav { transition: transform .5s cubic-bezier(.22,1,.36,1), opacity .35s ease, box-shadow .4s ease; }
        .customer-bottom-nav.is-minimized { transform: translateY(4px); box-shadow: 0 12px 40px -18px rgba(15,70,40,.42); }
        .customer-bottom-nav.is-hidden { transform: translateY(150%); opacity: 0; pointer-events:none; }
        .customer-nav-icon { transition: transform .45s cubic-bezier(.22,1,.36,1), opacity .35s ease, height .45s ease, margin .45s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-icon { transform: scale(.18); opacity:0; height:3px; margin-bottom:-3px; }
        .customer-nav-label { transition: transform .45s cubic-bezier(.22,1,.36,1), color .25s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-label { transform: translateY(1px) scale(1.06); color:#166534; }
        .customer-nav-home { transition: transform .45s cubic-bezier(.22,1,.36,1), box-shadow .45s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-home { transform: translateY(1px) scale(.76); }
        .customer-nav-live { animation: navPulse 2.4s ease-in-out infinite; }
        .customer-nav-shine { animation: navShine 3.8s ease-in-out infinite; }
        .customer-nav-dot { animation: navDot 1.8s ease-in-out infinite; }
        @keyframes navPulse { 0%,100%{box-shadow:0 10px 24px rgba(22,101,52,.28),0 0 0 0 rgba(74,222,128,.24)} 50%{box-shadow:0 14px 32px rgba(22,101,52,.38),0 0 0 7px rgba(74,222,128,0)} }
        @keyframes navShine { 0%,60%,100%{transform:translateX(-150%);opacity:0} 70%{opacity:.45} 84%{transform:translateX(180%);opacity:0} }
        @keyframes navDot { 0%,100%{transform:scale(.8);opacity:.65} 50%{transform:scale(1.25);opacity:1} }
        @media (prefers-reduced-motion: reduce) { .customer-bottom-nav,.customer-nav-icon,.customer-nav-label,.customer-nav-home,.customer-nav-live,.customer-nav-shine,.customer-nav-dot{animation:none!important;transition:none!important} }
      `}</style>

      <nav
        aria-label="কাস্টমার নেভিগেশন"
        aria-hidden={hidden}
        className={`customer-bottom-nav fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-[30] mx-auto max-w-[570px] rounded-[27px] border border-white/80 bg-white/94 p-1.5 shadow-[0_22px_65px_-24px_rgba(15,70,40,.48)] backdrop-blur-2xl sm:inset-x-3 sm:bottom-3 sm:rounded-[30px] sm:p-2 ${minimized ? "is-minimized" : ""} ${hidden ? "is-hidden" : ""}`}
      >
        <div className="pointer-events-none absolute inset-x-12 -top-px h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Link to="/shop" className={itemClass}>
            <span className="customer-nav-icon flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-emerald-700 shadow-[inset_0_1px_0_white] group-hover:bg-emerald-100 group-hover:shadow-sm"><PackageSearch className="h-[19px] w-[19px]" strokeWidth={2.25} /></span>
            <span className="customer-nav-label mt-1 text-[9px] font-black leading-none sm:text-[10px]">সকল পণ্য</span>
          </Link>

          <Link to="/offers" className={itemClass}>
            <span className="relative customer-nav-icon flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shadow-[inset_0_1px_0_white] group-hover:bg-amber-100 group-hover:shadow-sm"><Tag className="h-[18px] w-[18px]" strokeWidth={2.25} /><span className="customer-nav-dot absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" /></span>
            <span className="customer-nav-label mt-1 text-[9px] font-black leading-none sm:text-[10px]">অফার</span>
          </Link>

          <Link to="/" activeOptions={{ exact: true }} className="group relative flex h-[62px] w-[82px] shrink-0 flex-col items-center justify-center rounded-[21px] text-emerald-800 transition-all duration-300 active:scale-95 sm:h-[68px] sm:w-[92px]">
            <span className="customer-nav-home customer-nav-live relative -mt-5 flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-[21px] border-[3px] border-white bg-gradient-to-br from-[#14532d] via-[#15803d] to-[#84cc16] text-white ring-1 ring-emerald-200/80 sm:h-[64px] sm:w-[64px]">
              <span className="customer-nav-shine absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-22deg] bg-white/40 blur-md" />
              <Home className="relative h-[25px] w-[25px] drop-shadow-md sm:h-[27px] sm:w-[27px]" strokeWidth={2.5} />
            </span>
            <span className="customer-nav-label absolute bottom-0 text-[10px] font-black text-emerald-900 sm:text-[11px]">হোম</span>
          </Link>

          <button type="button" onClick={() => setContactOpen(true)} className={itemClass}>
            <span className="customer-nav-icon flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-emerald-700 shadow-[inset_0_1px_0_white] group-hover:bg-emerald-100 group-hover:shadow-sm"><Headset className="h-[19px] w-[19px]" strokeWidth={2.25} /></span>
            <span className="customer-nav-label mt-1 text-[9px] font-black leading-none sm:text-[10px]">যোগাযোগ</span>
          </button>

          <Link to="/profile" className={itemClass}>
            <span className="customer-nav-icon flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-emerald-700 shadow-[inset_0_1px_0_white] group-hover:bg-emerald-100 group-hover:shadow-sm"><UserRound className="h-[19px] w-[19px]" strokeWidth={2.25} /></span>
            <span className="customer-nav-label mt-1 text-[9px] font-black leading-none sm:text-[10px]">অ্যাকাউন্ট</span>
          </Link>
        </div>
      </nav>

      {contactOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-md sm:items-center" onClick={() => setContactOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-[30px] border border-white/60 bg-white shadow-[0_35px_110px_rgba(0,0,0,.32)] animate-in slide-in-from-bottom-8 zoom-in-95 duration-300">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-700 to-lime-700 px-5 py-6 text-white">
              <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-lime-200/20 blur-3xl" />
              <div className="absolute bottom-0 left-1/3 h-20 w-40 rounded-full bg-white/10 blur-3xl" />
              <button type="button" onClick={() => setContactOpen(false)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition hover:rotate-90 hover:bg-white/20"><X className="h-4 w-4" /></button>
              <div className="relative flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Headset className="h-6 w-6" /></div><div><div className="mb-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.18em] text-lime-200"><Sparkles className="h-3 w-3" /> Customer Care</div><h3 className="text-lg font-black">যোগাযোগ করুন</h3><p className="text-[11px] text-white/75">আমরা আপনার সাহায্যের জন্য প্রস্তুত</p></div></div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 p-4">
              <a href="tel:+8809644553383" onClick={() => trackContact({ method: "phone" })} className="group rounded-2xl border border-slate-200 p-3.5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"><Phone className="h-5 w-5 text-emerald-700" /><div className="mt-2 text-sm font-black">কল করুন</div><div className="text-[10px] text-slate-500">09644-553383</div></a>
              <a href="https://wa.me/8809644553383" target="_blank" rel="noreferrer" onClick={() => trackContact({ method: "whatsapp" })} className="group rounded-2xl border border-slate-200 p-3.5 transition hover:-translate-y-1 hover:border-green-300 hover:shadow-lg"><MessageCircle className="h-5 w-5 text-green-600" /><div className="mt-2 text-sm font-black">WhatsApp</div><div className="text-[10px] text-slate-500">২৪/৭ মেসেজ</div></a>
              <a href="mailto:info@sheikhseeds.com" onClick={() => trackContact({ method: "email" })} className="group rounded-2xl border border-slate-200 p-3.5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"><Mail className="h-5 w-5 text-emerald-700" /><div className="mt-2 text-sm font-black">ইমেইল</div><div className="text-[10px] text-slate-500">info@sheikhseeds.com</div></a>
              <div className="rounded-2xl border border-slate-200 p-3.5"><MapPin className="h-5 w-5 text-emerald-700" /><div className="mt-2 text-sm font-black">অফিস</div><div className="text-[10px] text-slate-500">গোপালগঞ্জ সদর, পাবলিক হল রোড</div></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
