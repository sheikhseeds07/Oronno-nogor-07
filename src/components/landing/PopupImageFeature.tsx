import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function PopupImageFeature({
  themeColor,
  logo,
  brand,
  title,
  text,
  cta,
  delay,
  image,
}: {
  themeColor: string;
  logo: string;
  brand: string;
  title: string;
  text: string;
  cta: string;
  delay: number;
  image?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button aria-label="close" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" />
      <div className="relative w-full max-w-sm rounded-3xl border-2 p-6 text-center shadow-2xl animate-scale-in overflow-hidden" style={{ borderColor: "#facc15", background: `linear-gradient(160deg, ${themeColor}, color-mix(in oklab, ${themeColor} 55%, #052e16))` }}>
        <button onClick={() => setOpen(false)} aria-label="বন্ধ করুন" className="absolute right-3 top-3 z-10 text-yellow-300 hover:text-yellow-200">
          <X className="w-5 h-5" strokeWidth={3} />
        </button>
        {image ? (
          <img src={image} alt={title || brand} className="relative w-full max-h-[55vh] rounded-2xl object-contain bg-white/10" />
        ) : (
          <div className="relative flex flex-col items-center gap-3">
            <span className="grid place-items-center w-16 h-16 rounded-full bg-white/15 ring-2 ring-white/30">
              <img src={logo} alt={brand} className="w-12 h-12 rounded-full object-cover" />
            </span>
            <h3 className="text-[22px] font-extrabold text-white tracking-tight">{title}</h3>
            <p className="text-[14px] leading-relaxed text-white/85">{text}</p>
          </div>
        )}
        <button onClick={() => setOpen(false)} className="relative mt-3 w-full rounded-full bg-white/15 ring-1 ring-white/30 px-6 py-3 font-extrabold text-white text-[16px] transition hover:bg-white/25">{cta}</button>
      </div>
    </div>
  );
}
