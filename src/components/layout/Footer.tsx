import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, MapPin } from "lucide-react";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
import { toImg } from "@/lib/img";

type Settings = { site_name?: string; tagline?: string; phone?: string; email?: string; address?: string; facebook?: string; youtube?: string; tiktok?: string; logo_url?: string };
const DEFAULT_LOGO = "/icon-512-v2.png";
function FacebookIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" /></svg>; }
function YoutubeIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z" /></svg>; }
function TikTokIcon({ className = "w-5 h-5" }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V8.95a8.16 8.16 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1.04-.31z" /></svg>; }

export function Footer() {
  const { data: row } = useQuery(publicSiteSettingsQuery);
  const s = ((row?.settings as Settings) ?? {}) as Settings;
  const phone = s.phone || "+৮৮০ ৯৬৪৪-৫৫৩৩৮৩"; const email = s.email || "info@sheikhseeds.com"; const address = s.address || "গোপালগঞ্জ সদর, পাবলিক হল রোড"; const name = s.site_name || "Sheikh Seeds"; const logoSrc = s.logo_url || DEFAULT_LOGO;
  if (typeof window !== "undefined" && window.location.pathname === "/landing/karala") return null;
  return (
    <footer className="relative mt-10 overflow-hidden bg-[#0f1a13] text-white">
      <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand via-emerald-400 to-brand" />
      <span className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-brand/20 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="container relative mx-auto px-4 py-7 sm:py-9">
        <div className="grid gap-6 text-center sm:grid-cols-[1.2fr_1fr_1fr] sm:gap-8 sm:text-left">
          <div className="reveal-up">
            <div className="flex items-center justify-center gap-2.5 sm:justify-start">
              <img src={toImg(logoSrc)} alt={name} width={44} height={44} loading="lazy" decoding="async" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-brand/50" />
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold tracking-tight">{name}</div>
                <div className="truncate text-[11px] text-white/60">{s.tagline || "বিশ্বাসে গড়া সবুজ ভবিষ্যৎ"}</div>
              </div>
            </div>
            <p className="mx-auto mt-2.5 max-w-xs text-[11.5px] leading-relaxed text-white/65 sm:mx-0">
              অরিজিনাল বীজ, গার্ডেন টুলস ও সার — সারা বাংলাদেশে ক্যাশ অন ডেলিভারিতে।
            </p>
            <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
              <a href="https://www.facebook.com/share/1DoMWrXv2i/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/80 ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-600 hover:text-white"><FacebookIcon className="h-4 w-4" /></a>
              {s.youtube && <a href={s.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/80 ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-600 hover:text-white"><YoutubeIcon className="h-4 w-4" /></a>}
              {s.tiktok && <a href={s.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/80 ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:bg-black hover:text-white"><TikTokIcon className="h-4 w-4" /></a>}
            </div>
          </div>

          <div className="reveal-up" style={{ animationDelay: "70ms" }}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand/90">দ্রুত লিংক</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-white/70 sm:grid-cols-1">
              <Link to="/" className="transition-colors hover:text-brand">হোম</Link>
              <Link to="/shop" className="transition-colors hover:text-brand">সকল পণ্য</Link>
              <Link to="/contact" className="transition-colors hover:text-brand">যোগাযোগ</Link>
              <Link to="/profile" className="transition-colors hover:text-brand">আমার একাউন্ট</Link>
            </div>
          </div>

          <div className="reveal-up" style={{ animationDelay: "140ms" }}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand/90">যোগাযোগ</div>
            <div className="space-y-1.5 text-[12px] text-white/70">
              <a href={`tel:${phone}`} className="flex items-center justify-center gap-2 transition-colors hover:text-brand sm:justify-start"><Phone className="h-3.5 w-3.5 shrink-0 text-brand" /><span className="truncate">{phone}</span></a>
              <a href={`mailto:${email}`} className="flex items-center justify-center gap-2 transition-colors hover:text-brand sm:justify-start"><Mail className="h-3.5 w-3.5 shrink-0 text-brand" /><span className="truncate">{email}</span></a>
              <div className="flex items-center justify-center gap-2 sm:justify-start"><MapPin className="h-3.5 w-3.5 shrink-0 text-brand" /><span className="truncate">{address}</span></div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-1.5 border-t border-white/10 pt-3.5 text-[11px] text-white/50 sm:flex-row">
          <span>© {new Date().getFullYear()} {name}। সর্বস্বত্ব সংরক্ষিত।</span>
          <span>ক্যাশ অন ডেলিভারি • সারা বাংলাদেশে</span>
        </div>
      </div>
    </footer>
  );
}
