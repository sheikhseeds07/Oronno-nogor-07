import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, MapPin, Leaf } from "lucide-react";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
import { toImg } from "@/lib/img";

type Settings = { site_name?: string; tagline?: string; phone?: string; email?: string; address?: string; facebook?: string; youtube?: string; tiktok?: string; logo_url?: string };
const DEFAULT_LOGO = "/icon-512-v2.png";
function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" /></svg>; }
function YoutubeIcon({ className = "h-4 w-4" }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z" /></svg>; }
function TikTokIcon({ className = "h-4 w-4" }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-2.89-2.89c.31 0 .61.05.88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 1 0 15.86 15V8.95a8.16 8.16 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1.04-.31z" /></svg>; }

export function Footer() {
  const { data: row } = useQuery(publicSiteSettingsQuery);
  const s = ((row?.settings as Settings) ?? {}) as Settings;
  const phone = s.phone || "+৮৮০ ৯৬৪৪-৫৫৩৩৮৩";
  const email = s.email || "info@sheikhseeds.com";
  const address = s.address || "গোপালগঞ্জ সদর, পাবলিক হল রোড";
  const name = s.site_name || "Sheikh Seeds";
  const logoSrc = s.logo_url || DEFAULT_LOGO;
  if (typeof window !== "undefined" && window.location.pathname === "/landing/karala") return null;

  return (
    <footer className="relative mt-8 overflow-hidden bg-[#07110c] text-white sm:mt-10">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-brand to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />
      <div className="container relative mx-auto px-4 py-8 sm:py-9">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Link to="/" className="group inline-flex flex-col items-center">
            <img src={toImg(logoSrc)} alt={name} width={52} height={52} loading="lazy" decoding="async" className="h-12 w-12 rounded-full object-cover ring-2 ring-brand/25 shadow-xl transition-transform duration-300 group-hover:scale-105" />
            <span className="mt-2 text-[17px] font-black tracking-tight">{name}</span>
          </Link>
          <p className="mt-1.5 max-w-lg text-[11px] leading-relaxed text-white/50">{s.tagline || "বিশ্বাসে গড়া সবুজ ভবিষ্যৎ"} • অরিজিনাল বীজ, গার্ডেন টুলস ও সার — মানসম্মত পণ্য ও নির্ভরযোগ্য ডেলিভারি।</p>

          <nav className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11.5px] font-semibold text-white/65">
            <Link to="/" className="transition-colors hover:text-brand">হোম</Link>
            <Link to="/shop" className="transition-colors hover:text-brand">সকল পণ্য</Link>
            <Link to="/contact" className="transition-colors hover:text-brand">যোগাযোগ</Link>
            <Link to="/profile" className="transition-colors hover:text-brand">আমার একাউন্ট</Link>
          </nav>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10.5px] text-white/50">
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-brand"><Phone className="h-3.5 w-3.5 text-brand" />{phone}</a>
            <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-brand"><Mail className="h-3.5 w-3.5 text-brand" />{email}</a>
            <span className="inline-flex max-w-full items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />{address}</span>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <a href={s.facebook || "https://www.facebook.com/share/1DoMWrXv2i/"} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-white/60 ring-1 ring-white/[0.09] transition-all duration-200 hover:-translate-y-1 hover:bg-blue-600 hover:text-white"><FacebookIcon /></a>
            {s.youtube && <a href={s.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-white/60 ring-1 ring-white/[0.09] transition-all duration-200 hover:-translate-y-1 hover:bg-red-600 hover:text-white"><YoutubeIcon /></a>}
            {s.tiktok && <a href={s.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-white/60 ring-1 ring-white/[0.09] transition-all duration-200 hover:-translate-y-1 hover:bg-black hover:text-white"><TikTokIcon /></a>}
          </div>
        </div>

        <div className="mx-auto mt-5 flex max-w-3xl flex-col items-center gap-1.5 border-t border-white/[0.07] pt-3 text-center text-[9.5px] text-white/30 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {name} • সর্বস্বত্ব সংরক্ষিত</span>
          <span className="inline-flex items-center gap-1"><Leaf className="h-3 w-3 text-brand/80" /> সারা বাংলাদেশে ক্যাশ অন ডেলিভারি</span>
        </div>
      </div>
    </footer>
  );
}
