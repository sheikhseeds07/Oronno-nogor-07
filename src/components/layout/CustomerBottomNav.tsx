import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Headset, Home, PackageSearch, UserRound, Users, X, Phone, MessageCircle, Mail, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { trackContact } from "@/lib/fbq";

const items = [
  { label: "হোম", to: "/", icon: Home },
  { label: "সকল পণ্য", to: "/shop", icon: PackageSearch },
  { label: "কমিউনিটি", to: "/social", icon: Users },
  { label: "আমার অ্যাকাউন্ট", to: "/profile", icon: UserRound },
];

export function CustomerBottomNav() {
  const { user, initialized } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);
  if (!initialized || !user) return null;

  return (
    <>
      <nav className="fixed inset-x-2 bottom-2 z-[70] mx-auto grid max-w-xl grid-cols-5 rounded-2xl border border-brand/10 bg-background/95 p-1 shadow-[0_14px_40px_rgba(15,70,40,.18)] backdrop-blur-xl sm:bottom-3 sm:rounded-2xl">
        {items.map(({ label, to, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/" }} activeProps={{ className: "bg-gradient-to-br from-brand to-brand-dark text-white shadow-md" }} className="group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-black text-muted-foreground transition-all duration-300 hover:bg-brand-light/60 hover:text-brand-dark sm:py-2 sm:text-[10px]">
            <Icon className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 sm:h-[17px] sm:w-[17px]" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setContactOpen(true)} className="group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-black text-muted-foreground transition-all duration-300 hover:bg-brand-light/60 hover:text-brand-dark sm:py-2 sm:text-[10px]">
          <Headset className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 sm:h-[17px] sm:w-[17px]" />
          <span className="truncate">যোগাযোগ</span>
        </button>
      </nav>

      {contactOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center" onClick={() => setContactOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-[26px] border border-white/40 bg-background shadow-[0_25px_80px_rgba(0,0,0,.25)] animate-in slide-in-from-bottom-8 zoom-in-95 duration-300 sm:slide-in-from-bottom-3">
            <div className="relative overflow-hidden bg-gradient-to-br from-brand via-brand-dark to-emerald-950 px-5 py-5 text-white">
              <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-lime-300/15 blur-2xl" />
              <button type="button" onClick={() => setContactOpen(false)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition hover:rotate-90 hover:bg-white/20"><X className="h-4 w-4" /></button>
              <div className="relative flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Headset className="h-5 w-5" /></div>
                <div><h3 className="text-lg font-black">যোগাযোগ করুন</h3><p className="text-[11px] text-white/75">আপনার প্রয়োজন অনুযায়ী যেকোনো মাধ্যমে কথা বলুন</p></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 p-3.5">
              <a href="tel:+8809644553383" onClick={() => trackContact({ method: "phone" })} className="group rounded-2xl border p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg">
                <Phone className="h-5 w-5 text-brand transition-transform group-hover:scale-110" /><div className="mt-2 text-sm font-black">কল করুন</div><div className="mt-0.5 text-[10px] text-muted-foreground">09644-553383</div>
              </a>
              <a href="https://wa.me/8809644553383" target="_blank" rel="noreferrer" onClick={() => trackContact({ method: "whatsapp" })} className="group rounded-2xl border p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-green-400/40 hover:shadow-lg">
                <MessageCircle className="h-5 w-5 text-green-600 transition-transform group-hover:scale-110" /><div className="mt-2 text-sm font-black">WhatsApp</div><div className="mt-0.5 text-[10px] text-muted-foreground">২৪/৭ মেসেজ</div>
              </a>
              <a href="mailto:info@sheikhseeds.com" onClick={() => trackContact({ method: "email" })} className="group rounded-2xl border p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg">
                <Mail className="h-5 w-5 text-brand transition-transform group-hover:scale-110" /><div className="mt-2 text-sm font-black">ইমেইল</div><div className="mt-0.5 text-[10px] text-muted-foreground">info@sheikhseeds.com</div>
              </a>
              <div className="rounded-2xl border p-3.5"><MapPin className="h-5 w-5 text-brand" /><div className="mt-2 text-sm font-black">অফিস</div><div className="mt-0.5 text-[10px] text-muted-foreground">গোপালগঞ্জ সদর, পাবলিক হল রোড</div></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
