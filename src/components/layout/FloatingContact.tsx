import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, MessagesSquare, Phone, X } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";

type ContactSettings = {
  contact_page_message_url?: string;
  contact_phone?: string;
};

export function FloatingContact() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: row } = useQuery({
    queryKey: ["site-settings-public"],
    queryFn: async () => (await supabase.from("site_settings").select("settings").maybeSingle()).data,
    staleTime: 60_000,
  });

  const settings = ((row?.settings as ContactSettings) ?? {}) as ContactSettings;
  const messageUrl = (settings.contact_page_message_url ?? "").trim();
  const phone = (settings.contact_phone ?? "+8809644553383").trim();

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
    };
  }, []);

  return (
    <>
      <style>{`
        /* Homepage category cards: image first, category name underneath. */
        div[style*="homeCategoryMarquee"] > button {
          background: transparent !important;
          border-color: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        div[style*="homeCategoryMarquee"] > button > div:first-child {
          order: 1 !important;
          margin-bottom: 0.625rem !important;
          border-radius: 1.5rem !important;
          box-shadow: 0 8px 24px -16px rgba(0, 0, 0, 0.45);
        }
        div[style*="homeCategoryMarquee"] > button > div:nth-child(2) {
          order: 2 !important;
          margin-bottom: 0 !important;
          font-size: 0.95rem;
          line-height: 1.35rem;
          color: var(--color-foreground) !important;
        }
      `}</style>

      <div ref={wrapRef} className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2.5 sm:bottom-5 sm:left-5">
        {open && (
          <div className="mb-0.5 w-[220px] overflow-hidden rounded-[22px] border border-brand/10 bg-white/90 p-2 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.35)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="px-3 pb-1.5 pt-2">
              <p className="text-[11px] font-semibold tracking-wide text-brand-dark/60">যোগাযোগ করুন</p>
            </div>

            {messageUrl ? (
              <a
                href={messageUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-3 rounded-[16px] px-2.5 py-2.5 transition-all duration-200 hover:bg-brand-light/60 active:scale-[0.98]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-brand-light text-brand-dark shadow-sm ring-1 ring-brand/10 transition-transform duration-200 group-hover:scale-105">
                  <MessageCircle className="h-[19px] w-[19px]" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-5 text-foreground">Page Message</span>
                  <span className="block text-[11px] leading-4 text-muted-foreground">মেসেজ করুন</span>
                </span>
                <span className="text-lg leading-none text-brand/50 transition-transform duration-200 group-hover:translate-x-0.5">›</span>
              </a>
            ) : (
              <div className="flex items-center gap-3 rounded-[16px] px-2.5 py-2.5 text-muted-foreground opacity-60">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-muted">
                  <MessageCircle className="h-[19px] w-[19px]" />
                </span>
                <span className="text-sm font-semibold">Page Message</span>
              </div>
            )}

            {phone ? (
              <a
                href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                onClick={() => setOpen(false)}
                className="group flex items-center gap-3 rounded-[16px] px-2.5 py-2.5 transition-all duration-200 hover:bg-brand-light/60 active:scale-[0.98]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-brand-light text-brand-dark shadow-sm ring-1 ring-brand/10 transition-transform duration-200 group-hover:scale-105">
                  <Phone className="h-[19px] w-[19px]" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-5 text-foreground">Call</span>
                  <span className="block text-[11px] leading-4 text-muted-foreground">সরাসরি কল করুন</span>
                </span>
                <span className="text-lg leading-none text-brand/50 transition-transform duration-200 group-hover:translate-x-0.5">›</span>
              </a>
            ) : (
              <div className="flex items-center gap-3 rounded-[16px] px-2.5 py-2.5 text-muted-foreground opacity-60">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-muted">
                  <Phone className="h-[19px] w-[19px]" />
                </span>
                <span className="text-sm font-semibold">Call</span>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "কন্টাক্ট অপশন বন্ধ করুন" : "কন্টাক্ট অপশন দেখুন"}
          aria-expanded={open}
          className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_12px_30px_-8px_rgba(22,163,74,0.55)] ring-4 ring-white/80 transition-all duration-200 hover:scale-105 hover:shadow-[0_16px_36px_-8px_rgba(22,163,74,0.6)] active:scale-95"
        >
          <span className="relative z-10 grid place-items-center">
            {open ? <X className="h-6 w-6" strokeWidth={2.4} /> : <MessagesSquare className="h-6 w-6" strokeWidth={2.2} />}
          </span>
          {!open && <span className="pointer-events-none absolute inset-0 rounded-full bg-white/20 animate-ping" />}
        </button>
      </div>
    </>
  );
}
