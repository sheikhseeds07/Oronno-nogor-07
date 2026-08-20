import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function PopupImage({ image, delay = 1200 }: { image?: string; delay?: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!image) return;
    const timer = window.setTimeout(() => setOpen(true), Math.max(0, Number(delay) || 0));
    return () => window.clearTimeout(timer);
  }, [image, delay]);

  if (!image || !open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <button aria-label="Close popup" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
        <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-2.5 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
          <X className="h-5 w-5" strokeWidth={3} />
        </button>
        <img src={image} alt="Popup offer" className="block h-auto max-h-[90vh] w-full object-contain" loading="eager" />
      </div>
    </div>
  );
}
