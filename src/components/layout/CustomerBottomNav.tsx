import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Headset, Home, PackageSearch, UserRound, Tag, Phone, MessageCircle, Mail, MapPin, X, ShoppingBag } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { trackContact } from "@/lib/fbq";

const navItems = [
  { label: "সকল পণ্য", to: "/shop", icon: PackageSearch },
  { label: "অফার", to: "/offers", icon: Tag },
  { label: "যোগাযোগ", type: "contact", icon: Headset },
  { label: "অ্যাকাউন্ট", to: "/profile", icon: UserRound },
] as const;

export function CustomerBottomNav({ hidden = false }: { hidden?: boolean }) {
  const { initialized } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setMinimized(y > 80 && y > lastY + 4);
        if (y < 35) setMinimized(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setPulse(false), 7000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!initialized) return null;

  return (
    <>
      <style>{`
        .customer-bottom-nav { transition: transform .45s cubic-bezier(.22,1,.36,1), opacity .35s ease, filter .35s ease; }
        .customer-bottom-nav.is-minimized { transform: translateY(7px) scale(.78); opacity: .9; filter: drop-shadow(0 10px 24px rgba(15,23,42,.18)); }
        .customer-bottom-nav.is-hidden { transform: translateY(150%) scale(.92); opacity: 0; pointer-events:none; }
        .customer-nav-home { box-shadow: 0 14px 32px rgba(20,83,45,.30), inset 0 1px 0 rgba(255,255,255,.35); }
        .customer-nav-live { animation: customerLive 2.2s ease-in-out infinite; }
        .customer-nav-shine { animation: customerShine 3.4s ease-in-out infinite; }
        @keyframes customerLive { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.28), 0 14px 32px rgba(20,83,45,.30); } 50% { box-shadow: 0 0 0 8px rgba(34,197,94,0), 0 18px 38px rgba(20,83,45,.36); } }
        @keyframes customerShine { 0%,55%,100% { transform:translateX(-130%); opacity:0; } 65% { opacity:.5; } 82% { transform:translateX(130%); opacity:0; } }
        @media (prefers-reduced-motion: reduce) { .customer-bottom-nav, .customer-nav-live, .customer-nav-shine { animation:none!important; transition:none!important; } }
      `}</style>
      <nav
        aria-label="কাস্টমার নেভিগেশন"
        aria-hidden={hidden}
        className={`customer-bottom-nav fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-[30] mx-auto flex max-w-[560px] items-center justify-between gap-1 rounded-[24px] border border-white/70 bg-white/88 px-2 py-2 shadow-[0_18px_60px_-22px_rgba(15,70,40,.42)] backdrop-blur-2xl sm:inset-x-3 sm:bottom-3 sm:rounded-[28px] sm:px-3 ${minimized ? "is-minimized" : ""} ${hidden ? "is-hidden" : ""}`}
      >
        <Link to="/" activeOptions={{ exact: true }} className="group relative flex h-[54px] w-[72px] shrink-0 flex-col items-center justify-center rounded-[19px] text-slate-500 transition-all duration-300 hover:-translate-y-0.5 hover:text-emerald-700 active:scale-95 sm:h-[58px] sm:w-[78px]">
          <span className="customer-nav-home customer-nav-live relative flex h-[47px] w-[47px] items-center justify-center overflow-hidden rounded-[17px] bg-gradient-to-br from-emerald-700 via-green-600 to-lime-500 text-white sm:h-[50px] sm:w-[50px]">
            <span className="customer-nav-shine absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] bg-white/35 blur-md" />
            <Home className="relative h-5 w-5 sm:h-[21px] sm:w-[21px]" strokeWidth={2.5} />
          </span>
          <span className="absolute -bottom-0.5 text-[9px] font-black text-emerald-800 sm:text-[10px]">হোম</span>
        </Link>

        {navItems.slice(0, 2).map(({ label, to, icon: Icon }) => (
          <Link key={to} to={to} className="group flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center rounded-[18px] text-slate-500 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 sm:h-[58px]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-white group-hover:shadow-sm">
              <Icon className="h-[19px] w-[19px]" strokeWidth={2.2} />
            </span>
            <span className="text-[9px] font-extrabold leading-none sm:text-[10px]">{label}</span>
          </Link>
        ))}

        {navItems.slice(2).map(({ label, to, type, icon: Icon }) => type === "contact" ? (
          <button key={label} type="button" onClick={() => setContactOpen(true)} className="group flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center rounded-[18px] text-slate-500 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 sm:h-[58px]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-white group-hover:shadow-sm"><Icon className="h-[19px] w-[19px]" strokeWidth={2.2} /></span>
            <span className="text-[9px] font-extrabold leading-none sm:text-[10px]">{label}</span>
          </button>
        ) : (
          <Link key={label} to={to} className="group flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center rounded-[18px] text-slate-500 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 sm:h-[58px]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-white group-hover:shadow-sm"><Icon className="h-[19px] w-[19px]" strokeWidth={2.2} /></span>
            <span className="text-[9px] font-extrabold leading-none sm:text-[10px]">{label}</span>
          </Link>
        ))}
      </nav>

      {contactOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-md sm:items-center" onClick={() => setContactOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-[30px] border border-white/50 bg-white shadow-[0_30px_100px_rgba(0,0,0,.30)] animate-in slide-in-from-bottom-8 zoom-in-95 duration-300">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-green-700 to-emerald-950 px-5 py-6 text-white">
              <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-lime-300/20 blur-3xl" />
              <button type="button" onClick={() => setContactOpen(false)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 transition hover:rotate-90 hover:bg-white/20"><X className="h-4 w-4" /></button>
              <div className="relative flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Headset className="h-6 w-6" /></div><div><h3 className="text-lg font-black">যোগাযোগ করুন</h3><p className="text-[11px] text-white/75">আমরা আপনার সাহায্যের জন্য প্রস্তুত</p></div></div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 p-4">
              <a href="tel:+8809644553383" onClick={() => trackContact({ method: "phone" })} className="group rounded-2xl border p-3.5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"><Phone className="h-5 w-5 text-emerald-700" /><div className="mt-2 text-sm font-black">কল করুন</div><div className="text-[10px] text-slate-500">09644-553383</div></a>
              <a href="https://wa.me/8809644553383" target="_blank" rel="noreferrer" onClick={() => trackContact({ method: "whatsapp" })} className="group rounded-2xl border p-3.5 transition hover:-translate-y-1 hover:border-green-300 hover:shadow-lg"><MessageCircle className="h-5 w-5 text-green-600" /><div className="mt-2 text-sm font-black">WhatsApp</div><div className="text-[10px] text-slate-500">২৪/৭ মেসেজ</div></a>
              <a href="mailto:info@sheikhseeds.com" onClick={() => trackContact({ method: "email" })} className="group rounded-2xl border p-3.5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"><Mail className="h-5 w-5 text-emerald-700" /><div className="mt-2 text-sm font-black">ইমেইল</div><div className="text-[10px] text-slate-500">info@sheikhseeds.com</div></a>
              <div className="rounded-2xl border p-3.5"><MapPin className="h-5 w-5 text-emerald-700" /><div className="mt-2 text-sm font-black">অফিস</div><div className="text-[10px] text-slate-500">গোপালগঞ্জ সদর, পাবলিক হল রোড</div></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
