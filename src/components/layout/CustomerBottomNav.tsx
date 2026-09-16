import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Headset, Home, PackageSearch, UserRound, Tag, Phone, MessageCircle, X, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { trackContact } from "@/lib/fbq";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";

export function CustomerBottomNav({ hidden = false }: { hidden?: boolean }) {
  const { initialized } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const { data: settingsRow } = useQuery(publicSiteSettingsQuery);
  const settings = settingsRow?.settings ?? {};
  const contactPhone = typeof settings.contact_phone === "string" ? settings.contact_phone.trim() : "";
  const messengerUrl = typeof settings.contact_page_message_url === "string" ? settings.contact_page_message_url.trim() : "";
  const hasContactOptions = Boolean(contactPhone || messengerUrl);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 40) setMinimized(false);
        else if (y > lastY + 5) setMinimized(true);
        else if (y < lastY - 7) setMinimized(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!contactOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContactOpen(false); };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [contactOpen]);

  if (!initialized) return null;

  const itemClass = "group relative flex h-[48px] min-w-0 flex-1 flex-col items-center justify-center rounded-[15px] text-slate-600 transition-all duration-300 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 sm:h-[52px]";
  const phoneHref = contactPhone ? `tel:${contactPhone.replace(/[^+\d]/g, "")}` : "";

  return (
    <>
      <style>{`
        .customer-bottom-nav { transition: transform .5s cubic-bezier(.22,1,.36,1), opacity .35s ease; }
        .customer-bottom-nav::before { content:""; position:absolute; inset:0; z-index:0; border-radius:22px; background:rgba(255,255,255,.985); border:1px solid rgba(15,23,42,.07); box-shadow:0 18px 48px -18px rgba(15,23,42,.24), 0 6px 18px -10px rgba(22,101,52,.22), inset 0 1px 0 rgba(255,255,255,.95); }
        .customer-bottom-nav::after { content:""; position:absolute; left:14%; right:14%; top:0; height:1px; border-radius:999px; background:linear-gradient(90deg,transparent,rgba(16,185,129,.38),rgba(132,204,22,.34),transparent); z-index:2; }
        .customer-bottom-nav > div { z-index:1; }
        .customer-bottom-nav.is-minimized { transform: translateY(2px); }
        .customer-bottom-nav.is-minimized::before { box-shadow:0 12px 34px -16px rgba(15,23,42,.22), 0 5px 16px -10px rgba(22,101,52,.18); }
        .customer-bottom-nav.is-hidden { transform: translateY(150%); opacity: 0; pointer-events:none; }
        .customer-nav-icon { transition: transform .45s cubic-bezier(.22,1,.36,1), opacity .35s ease, height .45s ease, margin .45s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-icon { transform: scale(.12); opacity:0; height:2px; margin-bottom:-2px; }
        .customer-nav-label { transition: transform .45s cubic-bezier(.22,1,.36,1), color .25s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-label { transform: translateY(1px) scale(1.03); color:#166534; }
        .customer-nav-home { transition: transform .45s cubic-bezier(.22,1,.36,1), box-shadow .45s ease; }
        .customer-bottom-nav.is-minimized .customer-nav-home { transform: translateY(1px) scale(.76); }
        .customer-nav-live { animation: navPulse 2.7s ease-in-out infinite; }
        .customer-nav-shine { animation: navShine 4.2s ease-in-out infinite; }
        .customer-nav-dot { animation: navDot 1.8s ease-in-out infinite; }
        .contact-modal-card { animation: contactIn .34s cubic-bezier(.22,1,.36,1); }
        .contact-modal-backdrop { animation: backdropIn .22s ease-out; }
        .contact-modal-glow { animation: contactGlow 3.2s ease-in-out infinite; }
        .contact-action { transition: transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s ease, border-color .28s ease; }
        .contact-action:hover { transform: translateY(-2px); }
        @keyframes contactIn { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes backdropIn { from{opacity:0} to{opacity:1} }
        @keyframes contactGlow { 0%,100%{transform:scale(.95);opacity:.35} 50%{transform:scale(1.08);opacity:.65} }
        @keyframes navPulse { 0%,100%{box-shadow:0 8px 20px rgba(22,101,52,.26),0 0 0 0 rgba(74,222,128,.16)} 50%{box-shadow:0 11px 25px rgba(22,101,52,.34),0 0 0 5px rgba(74,222,128,0)} }
        @keyframes navShine { 0%,60%,100%{transform:translateX(-150%);opacity:0} 70%{opacity:.4} 84%{transform:translateX(180%);opacity:0} }
        @keyframes navDot { 0%,100%{transform:scale(.8);opacity:.65} 50%{transform:scale(1.25);opacity:1} }
        @media (prefers-reduced-motion: reduce) { .customer-bottom-nav,.customer-nav-icon,.customer-nav-label,.customer-nav-home,.customer-nav-live,.customer-nav-shine,.customer-nav-dot,.contact-modal-card,.contact-modal-backdrop,.contact-modal-glow,.contact-action{animation:none!important;transition:none!important} }
      `}</style>

      <nav aria-label="কাস্টমার নেভিগেশন" aria-hidden={hidden} className={`customer-bottom-nav fixed inset-x-2 bottom-[max(7px,env(safe-area-inset-bottom))] z-[30] mx-auto max-w-[500px] rounded-[22px] p-1.5 sm:inset-x-3 sm:bottom-3 sm:p-2 ${minimized ? "is-minimized" : ""} ${hidden ? "is-hidden" : ""}`}>
        <div className="relative flex items-center gap-0.5 sm:gap-1">
          <Link to="/shop" className={itemClass}><span className="customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_white,0_2px_5px_rgba(16,185,129,.10)] group-hover:bg-emerald-100"><PackageSearch className="h-[17px] w-[17px]" strokeWidth={2.35} /></span><span className="customer-nav-label mt-1 text-[8.5px] font-black leading-none sm:text-[9px]">সকল পণ্য</span></Link>
          <Link to="/offers" className={itemClass}><span className="relative customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600 shadow-[inset_0_1px_0_white,0_2px_5px_rgba(245,158,11,.10)] group-hover:bg-amber-100"><Tag className="h-[17px] w-[17px]" strokeWidth={2.35} /><span className="customer-nav-dot absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" /></span><span className="customer-nav-label mt-1 text-[8.5px] font-black leading-none sm:text-[9px]">অফার</span></Link>
          <Link to="/" activeOptions={{ exact: true }} className="group relative z-10 flex h-[54px] w-[64px] shrink-0 flex-col items-center justify-center text-emerald-800 transition-all duration-300 active:scale-95 sm:h-[58px] sm:w-[70px]"><span className="customer-nav-home customer-nav-live relative -mt-1 flex h-[46px] w-[46px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#064e3b] via-[#15803d] to-[#84cc16] text-white shadow-[0_10px_26px_-7px_rgba(22,101,52,.62)]"><span className="customer-nav-shine absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-22deg] bg-white/40 blur-md" /><span className="absolute inset-1 rounded-full border border-white/15" /><Home className="relative h-[21px] w-[21px] drop-shadow-md sm:h-[22px] sm:w-[22px]" strokeWidth={2.5} /></span><span className="customer-nav-label mt-0.5 text-[8.5px] font-black text-emerald-900 sm:text-[9px]">হোম</span></Link>
          <button type="button" onClick={() => setContactOpen(true)} className={itemClass}><span className="customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_white,0_2px_5px_rgba(16,185,129,.10)] group-hover:bg-emerald-100"><Headset className="h-[17px] w-[17px]" strokeWidth={2.35} /></span><span className="customer-nav-label mt-1 text-[8.5px] font-black leading-none sm:text-[9px]">যোগাযোগ</span></button>
          <Link to="/profile" className={itemClass}><span className="customer-nav-icon flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_white,0_2px_5px_rgba(16,185,129,.10)] group-hover:bg-emerald-100"><UserRound className="h-[17px] w-[17px]" strokeWidth={2.35} /></span><span className="customer-nav-label mt-1 text-[8.5px] font-black leading-none sm:text-[9px]">অ্যাকাউন্ট</span></Link>
        </div>
      </nav>

      {contactOpen && (
        <div className="contact-modal-backdrop fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setContactOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="যোগাযোগ করুন" onClick={(e) => e.stopPropagation()} className="contact-modal-card relative w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_35px_100px_rgba(0,0,0,.35)]">
            <div className="relative overflow-hidden bg-slate-950 px-5 pb-6 pt-5 text-white sm:px-6">
              <div className="contact-modal-glow absolute -right-12 -top-16 h-48 w-48 rounded-full bg-emerald-400/25 blur-3xl" />
              <div className="absolute -bottom-20 left-10 h-32 w-40 rounded-full bg-lime-400/10 blur-3xl" />
              <button type="button" aria-label="বন্ধ করুন" onClick={() => setContactOpen(false)} className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 active:scale-90"><X className="h-4 w-4" strokeWidth={2.5} /></button>
              <div className="relative flex items-start gap-3 pr-10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-emerald-400 to-lime-300 text-slate-950 shadow-[0_10px_28px_rgba(52,211,153,.25)]"><Headset className="h-6 w-6" strokeWidth={2.25} /></div>
                <div className="pt-0.5">
                  <div className="mb-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.2em] text-emerald-300"><Sparkles className="h-3 w-3" /> Customer Care</div>
                  <h3 className="text-[20px] font-black tracking-tight">আমাদের সাথে যোগাযোগ করুন</h3>
                  <p className="mt-1 text-[10px] leading-4 text-white/60">আপনার প্রয়োজন অনুযায়ী নিচের যেকোনো একটি মাধ্যম বেছে নিন</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              {hasContactOptions ? (
                <>
                  {contactPhone && (
                    <a href={phoneHref} onClick={() => trackContact({ method: "phone" })} className="contact-action group flex items-center gap-3.5 rounded-[21px] border border-emerald-100 bg-emerald-50/60 p-3.5 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-[0_14px_32px_-20px_rgba(16,185,129,.55)]">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-emerald-600 text-white shadow-[0_9px_22px_-10px_rgba(5,150,105,.8)]"><Phone className="h-5 w-5" strokeWidth={2.4} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[14px] font-black text-slate-900">কল করুন</span><span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">{contactPhone}</span></span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm"><ArrowUpRight className="h-4 w-4" /></span>
                    </a>
                  )}
                  {messengerUrl && (
                    <a href={messengerUrl} target="_blank" rel="noreferrer" onClick={() => trackContact({ method: "messenger" })} className="contact-action group flex items-center gap-3.5 rounded-[21px] border border-sky-100 bg-sky-50/60 p-3.5 hover:border-sky-300 hover:bg-sky-50 hover:shadow-[0_14px_32px_-20px_rgba(14,165,233,.55)]">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-sky-600 text-white shadow-[0_9px_22px_-10px_rgba(2,132,199,.8)]"><MessageCircle className="h-5 w-5" strokeWidth={2.4} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[14px] font-black text-slate-900">Messenger</span><span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">সরাসরি আমাদের Messenger-এ মেসেজ করুন</span></span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm"><ArrowUpRight className="h-4 w-4" /></span>
                    </a>
                  )}
                </>
              ) : (
                <div className="rounded-[21px] border border-slate-200 bg-slate-50 p-5 text-center"><Headset className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-[12px] font-bold text-slate-600">যোগাযোগের তথ্য এখনো সেট করা হয়নি</p></div>
              )}
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-center text-[9px] font-bold text-slate-400">কন্টাক্ট সেটিংস থেকে Call ও Messenger তথ্য পরিবর্তন করা যাবে</div>
          </div>
        </div>
      )}
    </>
  );
}
