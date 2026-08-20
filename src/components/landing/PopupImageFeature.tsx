import { useEffect, useState } from "react";
import { X } from "lucide-react";

type PopupImageFeatureProps = {
  delay: number;
  image?: string;
  title?: string;
  themeColor?: string;
  logo?: string;
  brand?: string;
  text?: string;
  cta?: string;
};

export function PopupImageFeature({ delay, image, title }: PopupImageFeatureProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!open || !image) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <button aria-label="close" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" />
      <div className="relative w-full max-w-lg max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl animate-scale-in bg-white">
        <button onClick={() => setOpen(false)} aria-label="বন্ধ করুন" className="absolute right-2 top-2 z-10 grid place-items-center w-9 h-9 rounded-full bg-black/60 text-white hover:bg-black/75">
          <X className="w-5 h-5" strokeWidth={3} />
        </button>
        <img src={image} alt={title || "Popup"} className="block w-full max-h-[92vh] object-contain" />
      </div>
    </div>
  );
}
