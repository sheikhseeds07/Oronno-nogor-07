import { Phone } from "lucide-react";

export function FloatingContact() {
  return (
    <a
      href="tel:+8809644553383"
      aria-label="কল করুন +8809644553383"
      className="fixed bottom-4 left-4 z-30 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-gradient-to-br from-brand to-brand-dark text-white shadow-xl hover:scale-105 active:scale-95 transition will-change-transform"
    >
      <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
        <Phone className="w-4 h-4" />
        <span className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
      </span>
      <span className="text-sm font-bold tracking-wide">কল করুন</span>
    </a>
  );
}
