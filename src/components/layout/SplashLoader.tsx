import { useEffect, useState } from "react";
import logo from "@/assets/logo.jpg";

// Only show a splash on the very first paint of the session. Never on route
// navigations — those should feel instant (the site is a SPA with prefetch).
let shownOnce = false;

export function SplashLoader() {
  const [show, setShow] = useState(!shownOnce);

  useEffect(() => {
    if (shownOnce) return;
    shownOnce = true;
    const t = setTimeout(() => setShow(false), 250);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-brand/20 animate-ping" />
          <img
            src={logo}
            alt="Oronno Nogor"
            className="relative w-16 h-16 rounded-full object-cover ring-4 ring-brand/40 shadow-lg"
          />
        </div>
        <div className="font-extrabold text-brand-dark text-lg tracking-tight">অরন্য নগর</div>
      </div>
    </div>
  );
}
