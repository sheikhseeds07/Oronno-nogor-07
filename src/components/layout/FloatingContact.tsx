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

      <div ref={wrapRef} className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2">
        {open && (
          <div className="mb-1 w-48 overflow-hidden rounded-2xl border border-brand/15 bg-white/95 p-2 shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
            {messageUrl ? (
              <a
                href={messageUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-brand-light/50 transition-colors"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-light text-brand-dark">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span>Page Message</span>
              </a>
            ) : (
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground opacity-60">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-muted">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span>Page Message</span>
              </div>
            )}

            {phone ? (
              <a
                href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-brand-light/50 transition-colors"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-light text-brand-dark">
                  <Phone className="h-4 w-4" />
                </span>
                <span>Call</span>
              </a>
            ) : (
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground opacity-60">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-muted">
                  <Phone className="h-4 w-4" />
                </span>
                <span>Call</span>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "কন্টাক্ট অপশন বন্ধ করুন" : "কন্টাক্ট অপশন দেখুন"}
          aria-expanded={open}
          className="relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-white shadow-xl shadow-brand/25 transition hover:scale-105 active:scale-95"
        >
          {open ? <X className="h-6 w-6" /> : <MessagesSquare className="h-6 w-6" />}
          {!open && <span className="pointer-events-none absolute inset-0 rounded-full bg-brand/25 animate-ping" />}
        </button>
      </div>
    </>
  );
}
