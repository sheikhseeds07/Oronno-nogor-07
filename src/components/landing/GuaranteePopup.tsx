import { useEffect, useState } from "react";

/**
 * Guarantee card + growing-instruction popup for landing page templates.
 *
 * Same logic as before: shows once per session per slug, stays visible for
 * 10 seconds, then closes itself. The CTA button only dismisses the popup —
 * it never scrolls the page.
 */

const POPUP_DURATION = 10000;

export const GUARANTEE_POPUP_STYLE = `
@keyframes gpFade{from{opacity:0}to{opacity:1}}
@keyframes gpCard{0%{opacity:0;transform:scale(.9)}60%{opacity:1;transform:scale(1.015)}100%{opacity:1;transform:scale(1)}}
@keyframes gpLogo{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes gpAura{0%,100%{transform:scale(.92);opacity:.35}50%{transform:scale(1.16);opacity:.7}}
@keyframes gpShine{0%,30%{transform:translateX(-150%) skewX(-18deg);opacity:0}45%{opacity:.7}75%,100%{transform:translateX(300%) skewX(-18deg);opacity:0}}
@keyframes gpCtaLift{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes gpSpark{0%{transform:translateY(0) scale(.6);opacity:0}25%{opacity:.9}100%{transform:translateY(-52px) scale(1);opacity:0}}
@keyframes gpRing{from{stroke-dashoffset:0}to{stroke-dashoffset:113}}
@keyframes gpBorder{to{background-position:200% 0}}
@keyframes gpGlow{0%,100%{opacity:.25}50%{opacity:.6}}
.gp-popup{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;animation:gpFade .26s ease-out}
.gp-backdrop{position:absolute;inset:0;background:rgba(2,18,12,.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.gp-card{position:relative;width:min(360px,90vw);aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 24px 22px;border-radius:28px;color:#fff;text-align:center;overflow:hidden;background:radial-gradient(circle at 50% 0%,#075e45 0%,#04352a 56%,#01201a 100%);box-shadow:0 34px 90px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12);animation:gpCard .5s cubic-bezier(.22,1,.36,1)}
.gp-card::before{content:"";position:absolute;inset:0;border-radius:28px;padding:1.5px;background:linear-gradient(120deg,rgba(134,239,172,.6),rgba(253,230,138,.55),rgba(134,239,172,.6));background-size:200% 100%;animation:gpBorder 4.5s linear infinite;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.gp-card::after{content:"";position:absolute;width:240px;height:240px;top:-90px;right:-80px;border-radius:999px;background:radial-gradient(circle,rgba(34,197,94,.26),transparent 70%);animation:gpGlow 4s ease-in-out infinite;pointer-events:none}
.gp-spark{position:absolute;bottom:20%;width:5px;height:5px;border-radius:999px;background:rgba(187,247,208,.85);pointer-events:none;animation:gpSpark 3.4s ease-in-out infinite}
.gp-spark:nth-of-type(1){left:16%;animation-delay:.2s}
.gp-spark:nth-of-type(2){left:48%;animation-delay:1.3s}
.gp-spark:nth-of-type(3){left:82%;animation-delay:2.2s}
.gp-close{position:absolute;right:10px;top:10px;width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:21px;line-height:1;cursor:pointer;transition:transform .2s,background .2s;z-index:2}
.gp-close:hover{transform:rotate(90deg);background:rgba(255,255,255,.16)}
.gp-logo-wrap{position:relative;width:82px;height:82px;display:grid;place-items:center}
.gp-logo-aura{position:absolute;inset:4px;border-radius:999px;background:rgba(34,197,94,.3);animation:gpAura 2.8s ease-in-out infinite}
.gp-logo{position:relative;width:62px;height:62px;border-radius:999px;object-fit:cover;border:2px solid rgba(187,247,208,.55);box-shadow:0 14px 34px rgba(34,197,94,.32),inset 0 1px 0 rgba(255,255,255,.25);animation:gpLogo 2.8s ease-in-out infinite;background:#04352a}
.gp-timer{position:absolute;inset:0;transform:rotate(-90deg)}
.gp-timer circle{fill:none;stroke-width:2.5;stroke-linecap:round}
.gp-timer .gp-timer-track{stroke:rgba(255,255,255,.12)}
.gp-timer .gp-timer-bar{stroke:#fde68a;stroke-dasharray:113;animation:gpRing 10s linear forwards}
.gp-card h2{margin:18px 0 10px;font-size:23px;font-weight:900;line-height:1.3;background:linear-gradient(135deg,#fff,#bbf7d0);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.gp-card p{margin:0;color:#d1fae5;font-size:13px;line-height:1.7;max-width:288px}
.gp-cta{position:relative;overflow:hidden;width:100%;max-width:280px;margin-top:20px;padding:12px 16px;border:1px solid rgba(134,239,172,.5);border-radius:14px;background:linear-gradient(135deg,#22c55e 0%,#166534 55%,#14532d 100%);color:#fff;font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 14px 32px rgba(5,46,22,.4),inset 0 1px 0 rgba(255,255,255,.22);cursor:pointer;animation:gpCtaLift 2.8s ease-in-out infinite;transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s}
.gp-cta:hover{box-shadow:0 18px 40px rgba(5,46,22,.5)}
.gp-cta:active{transform:scale(.985)}
.gp-cta::after{content:"";position:absolute;top:0;bottom:0;left:0;width:34%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent);animation:gpShine 3.2s ease-in-out infinite;pointer-events:none}
.gp-closing .gp-backdrop{opacity:0;transition:opacity .22s ease}
.gp-closing .gp-card{opacity:0;transform:scale(.96);transition:opacity .22s ease,transform .22s ease}
@media (max-width:400px){.gp-card{padding:20px 16px 18px}.gp-card h2{font-size:20px;margin:14px 0 8px}.gp-card p{font-size:12px}.gp-logo-wrap{width:74px;height:74px}.gp-logo{width:56px;height:56px}}
@media (max-height:560px){.gp-card{aspect-ratio:auto;height:auto}}
@media (prefers-reduced-motion:reduce){.gp-popup,.gp-card,.gp-card::after,.gp-logo,.gp-logo-aura,.gp-cta,.gp-cta::after,.gp-spark,.gp-card::before{animation:none!important}}
`;

export function GuaranteePopup({ slug, delay = 600, logo, brand = "" }: { slug: string; delay?: number; logo?: string; brand?: string }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const popupKey = `hng-guarantee-seen:${slug}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    let seen = false;
    try { seen = window.sessionStorage.getItem(popupKey) === "1"; } catch { seen = false; }
    if (seen) return;
    try { window.sessionStorage.setItem(popupKey, "1"); } catch { /* ignore */ }
    const openTimer = window.setTimeout(() => setOpen(true), delay);
    const closeTimer = window.setTimeout(() => setOpen(false), delay + POPUP_DURATION);
    return () => { window.clearTimeout(openTimer); window.clearTimeout(closeTimer); };
  }, [popupKey, delay]);

  // Dismiss only: never scroll the page, never navigate.
  const close = (event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setClosing(true);
    window.setTimeout(() => { setOpen(false); setClosing(false); }, 220);
  };

  if (!open) return null;

  return (
    <>
      <style>{GUARANTEE_POPUP_STYLE}</style>
      <div className={`gp-popup${closing ? " gp-closing" : ""}`} role="dialog" aria-modal="true" aria-label="গ্যারান্টি কার্ড ও নির্দেশনা">
        <div className="gp-backdrop" onClick={close} />
        <div className="gp-card">
          <span className="gp-spark" aria-hidden="true" />
          <span className="gp-spark" aria-hidden="true" />
          <span className="gp-spark" aria-hidden="true" />
          <button type="button" className="gp-close" onClick={close} aria-label="বন্ধ করুন">×</button>
          <div className="gp-logo-wrap">
            <span className="gp-logo-aura" aria-hidden="true" />
            <svg className="gp-timer" viewBox="0 0 40 40" aria-hidden="true">
              <circle className="gp-timer-track" cx="20" cy="20" r="18" />
              <circle className="gp-timer-bar" cx="20" cy="20" r="18" />
            </svg>
            {logo && <img className="gp-logo" src={logo} alt={brand} width={62} height={62} />}
          </div>
          <h2>গ্যারান্টি কার্ড ও নির্দেশনা</h2>
          <p>প্রতিটি অর্ডারের সাথে থাকছে <strong>গ্যারান্টি কার্ড</strong> এবং বীজ থেকে চারা তৈরির সম্পূর্ণ গাইডলাইন।</p>
          <button type="button" className="gp-cta" onClick={close}>
            <span>এখনই কিনুন</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </>
  );
}
