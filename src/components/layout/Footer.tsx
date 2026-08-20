import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, MapPin } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";
import logo from "@/assets/logo.jpg";
import { toImg } from "@/lib/img";

type Settings = {
  site_name?: string; tagline?: string; phone?: string; email?: string; address?: string;
  facebook?: string; youtube?: string; tiktok?: string; logo_url?: string;
};

function FacebookIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
    </svg>
  );
}
function YoutubeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z" />
    </svg>
  );
}
function TikTokIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V8.95a8.16 8.16 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1.04-.31z" />
    </svg>
  );
}

export function Footer() {
  const { data: row } = useQuery({
    queryKey: ["site-settings-public"],
    queryFn: async () => (await supabase.from("site_settings").select("settings").maybeSingle()).data,
    staleTime: 60_000,
  });
  const s = ((row?.settings as Settings) ?? {}) as Settings;
  const phone = s.phone || "+৮৮০ ৯৬৪৪-৫৫৩৩৮৩";
  const email = s.email || "info@oronnonogor.com";
  const address = s.address || "গোপালগঞ্জ সদর, পাবলিক হল রোড";
  const name = s.site_name || "Oronno Nogor";
  const logoSrc = s.logo_url || logo;

  return (
    <footer className="bg-[#1a1a1a] text-white mt-12">
      <div className="container mx-auto px-4 py-10 text-center">
        <img src={toImg(logoSrc)} alt={name} width={64} height={64} loading="lazy" decoding="async" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
        <p className="text-sm text-white/85 mb-5">{s.tagline || "দেশী ও বিদেশী বীজ এর একটি বিশ্বস্ত প্রতিষ্ঠান"}</p>

        <div className="flex flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:text-sm text-white/85 mb-4">
          <a href={`tel:${phone}`} className="flex items-center gap-1.5 hover:text-brand">
            <Phone className="w-4 h-4 text-brand" /><span>{phone}</span>
          </a>
          <span className="text-white/30">|</span>
          <a href={`mailto:${email}`} className="flex items-center gap-1.5 hover:text-brand">
            <Mail className="w-4 h-4 text-brand" /><span>{email}</span>
          </a>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-white/85 mb-5">
          <MapPin className="w-4 h-4 text-brand" />
          <span>{address}</span>
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <a href="https://www.facebook.com/share/14p1iVqUFoG/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center hover:scale-110 transition">
            <FacebookIcon className="w-5 h-5" />
          </a>
          {s.youtube && (
            <a href={s.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center hover:scale-110 transition">
              <YoutubeIcon className="w-5 h-5" />
            </a>
          )}
          {s.tiktok && (
            <a href={s.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-10 h-10 rounded-full bg-black flex items-center justify-center hover:scale-110 transition">
              <TikTokIcon />
            </a>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/70 mb-4">
          <Link to="/" className="hover:text-white">হোম</Link>
          <Link to="/shop" className="hover:text-white">সকল পণ্য</Link>
          <Link to="/contact" className="hover:text-white">যোগাযোগ</Link>
          <Link to="/profile" className="hover:text-white">আমার একাউন্ট</Link>
        </div>

        <div className="border-t border-white/10 pt-4 text-xs text-white/60">
          © {new Date().getFullYear()} {name}। সর্বস্বত্ব সংরক্ষিত।
        </div>
      </div>
    </footer>
  );
}
