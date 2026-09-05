import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, MapPin, ArrowUpRight, Leaf } from "lucide-react";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
import { toImg } from "@/lib/img";

type Settings = {
  site_name?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
  logo_url?: string;
};

const DEFAULT_LOGO = "/icon-512-v2.png";

function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" /></svg>;
}

function YoutubeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z" /></svg>;
}

function TikTokIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V8.95a8.16 8.16 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1.04-.31z" /></svg>;
}

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
    <footer className="relative mt-8 overflow-hidden bg-[#0b1510] text-white sm:mt-10">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand/40 via-brand to-emerald-400/60" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-52 w-52 rounded-full bg-brand/10 blur-3xl" />

      <div className="container relative mx-auto px-4 py-6 sm:py-7">
        <div className="grid items-center gap-6 sm:grid-cols-[1.4fr_0.8fr_1.2fr] sm:gap-8">
          {/* Brand */}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <img
                  src={toImg(logoSrc)}
                  alt={name}
                  width={42}
                  height={42}
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/10"
                />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white ring-2 ring-[#0b1510]">
                  <Leaf className="h-2.5 w-2.5" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold tracking-tight">{name}</div>
                <div className="truncate text-[10px] text-white/50">{s.tagline || "বিশ্বাসে গড়া সবুজ ভবিষ্যৎ"}</div>
              </div>
            </div>
            <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-white/55">
              অরিজিনাল বীজ, গার্ডেন টুলস ও সার — সারা বাংলাদেশে নির্ভরযোগ্য ডেলিভারি।
            </p>
            <div className="mt-2.5 flex gap-1.5">
              <a href={s.facebook || "https://www.facebook.com/share/1DoMWrXv2i/"} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/60 ring-1 ring-white/[0.08] transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-600 hover:text-white"><FacebookIcon /></a>
              {s.youtube && <a href={s.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/60 ring-1 ring-white/[0.08] transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-600 hover:text-white"><YoutubeIcon /></a>}
              {s.tiktok && <a href={s.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/60 ring-1 ring-white/[0.08] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:text-white"><TikTokIcon /></a>}
            </div>
          </div>

          {/* Links */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-brand">দ্রুত লিংক</div>
            <nav className="grid grid-cols-2 gap-x-5 gap-y-1 text-[11.5px] text-white/60 sm:grid-cols-1 sm:gap-y-1.5">
              <Link to="/" className="transition-colors hover:text-brand">হোম</Link>
              <Link to="/shop" className="transition-colors hover:text-brand">সকল পণ্য</Link>
              <Link to="/contact" className="transition-colors hover:text-brand">যোগাযোগ</Link>
              <Link to="/profile" className="transition-colors hover:text-brand">আমার একাউন্ট</Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="min-w-0">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-brand">যোগাযোগ</div>
            <div className="space-y-1.5 text-[11.5px] text-white/60">
              <a href={`tel:${phone}`} className="flex items-center gap-2 transition-colors hover:text-brand"><Phone className="h-3.5 w-3.5 shrink-0 text-brand" /><span className="truncate">{phone}</span><ArrowUpRight className="ml-auto h-3 w-3 shrink-0 opacity-40" /></a>
              <a href={`mailto:${email}`} className="flex items-center gap-2 transition-colors hover:text-brand"><Mail className="h-3.5 w-3.5 shrink-0 text-brand" /><span className="truncate">{email}</span><ArrowUpRight className="ml-auto h-3 w-3 shrink-0 opacity-40" /></a>
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-brand" /><span className="truncate">{address}</span></div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-white/[0.08] pt-3 text-[10px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {name} • সর্বস্বত্ব সংরক্ষিত</span>
          <span>ক্যাশ অন ডেলিভারি • সারা বাংলাদেশে</span>
        </div>
      </div>
    </footer>
  );
}
