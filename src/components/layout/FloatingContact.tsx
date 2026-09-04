import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, MessagesSquare, Phone, X } from "lucide-react";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";

type ContactSettings = { contact_page_message_url?: string; contact_phone?: string };

export function FloatingContact() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { data: row } = useQuery(publicSiteSettingsQuery);
  const settings = ((row?.settings as ContactSettings) ?? {}) as ContactSettings;
  const messageUrl = (settings.contact_page_message_url ?? "").trim();
  const phone = (settings.contact_phone ?? "+8809644553383").trim();

  useEffect(() => {
    const close = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes contact-message-in { 0%{opacity:0;transform:translateY(18px) scale(.55) rotate(-10deg)} 70%{transform:translateY(-3px) scale(1.08) rotate(2deg)} 100%{opacity:1;transform:none} }
        @keyframes contact-call-in { 0%{opacity:0;transform:translateY(18px) scale(.55) rotate(10deg)} 70%{transform:translateY(-3px) scale(1.08) rotate(-2deg)} 100%{opacity:1;transform:none} }
        @keyframes contact-ring { 0%{transform:scale(1);opacity:.3} 100%{transform:scale(1.35);opacity:0} }
        .contact-message-in{animation:contact-message-in .34s cubic-bezier(.2,.8,.2,1) both}
        .contact-call-in{animation:contact-call-in .38s cubic-bezier(.2,.8,.2,1) .05s both}
        .contact-ring::after{content:"";position:absolute;inset:-5px;border:2px solid currentColor;border-radius:9999px;animation:contact-ring 1.7s ease-out infinite}
      `}</style>
      <div ref={wrapRef} className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-3 sm:bottom-5 sm:left-5">
        {open && (
          <div className="flex flex-col items-start gap-3">
            {messageUrl && (
              <a href={messageUrl} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} aria-label="Page Message" className="contact-message-in group flex items-center gap-2.5">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#1877F2] text-white shadow-[0_10px_25px_-7px_rgba(24,119,242,.65)] ring-4 ring-white/80 transition-transform duration-200 group-hover:scale-110 group-active:scale-95"><MessageCircle className="h-5 w-5" strokeWidth={2.5}/></span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-md ring-1 ring-slate-200/80">Message</span>
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} onClick={() => setOpen(false)} aria-label="Call" className="contact-call-in group flex items-center gap-2.5">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#16A34A] text-white shadow-[0_10px_25px_-7px_rgba(22,163,74,.65)] ring-4 ring-white/80 transition-transform duration-200 group-hover:scale-110 group-active:scale-95"><Phone className="h-5 w-5" strokeWidth={2.5}/></span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-md ring-1 ring-slate-200/80">Call</span>
              </a>
            )}
          </div>
        )}
        <button type="button" onClick={() => setOpen(v => !v)} aria-label={open ? "Close contact options" : "Open contact options"} aria-expanded={open} className={`relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_14px_34px_-8px_rgba(22,163,74,.6)] ring-4 ring-white/85 transition-all duration-300 hover:scale-105 active:scale-95 ${open ? "rotate-90" : ""}`}>
          <span className="relative z-10">{open ? <X className="h-6 w-6" strokeWidth={2.5}/> : <MessagesSquare className="h-6 w-6" strokeWidth={2.2}/>}</span>
          {!open && <span className="contact-ring pointer-events-none absolute inset-0 rounded-full text-brand"/>}
        </button>
      </div>
    </>
  );
}
