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
@keyframes gpCard{0%{opacity:0;transform:scale(.88) translateY(14px)}60%{opacity:1;transform:scale(1.02) translateY(0)}100%{opacity:1;transform:scale(1) translateY(0)}}
@keyframes gpLogo{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes gpAura{0%,100%{transform:scale(.9);opacity:.3}50%{transform:scale(1.2);opacity:.75}}
@keyframes gpShine{0%,30%{transform:translateX(-150%) skewX(-18deg);opacity:0}45%{opacity:.75}75%,100%{transform:translateX(300%) skewX(-18deg);opacity:0}}
@keyframes gpCtaLift{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes gpSpark{0%{transform:translateY(0) scale(.6);opacity:0}25%{opacity:.9}100%{transform:translateY(-56px) scale(1);opacity:0}}
@keyframes gpBorder{to{background-position:200% 0}}
@keyframes gpGlow{0%,100%{opacity:.25}50%{opacity:.65}}
@keyframes gpDivider{0%,100%{transform:scaleX(.55);opacity:.5}50%{transform:scaleX(1);opacity:1}}
@keyframes gpTrust{0%,100%{opacity:.85}50%{opacity:1}}
.gp-popup{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;animation:gpFade .26s ease-out}
.gp-backdrop{position:absolute;inset:0;background:rgba(2,18,12,.55);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.gp-card{position:relative;width:min(370px,92vw);aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:26px 26px 22px;border-radius:28px;color:#fff;text-align:center;overflow:hidden;background:radial-gradient(circle at 50% 0%,#0a6b50 0%,#04352a 58%,#011c16 100%);box-shadow:0 38px 100px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.14);animation:gpCard .55s cubic-bezier(.22,1,.36,1)}
.gp-card::before{content:"";position:absolute;inset:0;border-radius:28px;padding:1.5px;background:linear-gradient(120deg,rgba(134,239,172,.65),rgba(253,230,138,.6),rgba(251,207,232,.4),rgba(134,239,172,.65));background-size:200% 100%;animation:gpBorder 5s linear infinite;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.gp-card::after{content:"";position:absolute;width:260px;height:260px;top:-100px;right:-90px;border-radius:999px;background:radial-gradient(circle,rgba(34,197,94,.3),transparent 70%);animation:gpGlow 4s ease-in-out infinite;pointer-events:none}
.gp-ring{position:absolute;inset:7px;border-radius:22px;border:1px solid rgba(255,255,255,.09);pointer-events:none}
.gp-spark{position:absolute;bottom:22%;width:5px;height:5px;border-radius:999px;background:rgba(187,247,208,.9);box-shadow:0 0 8px rgba(187,247,208,.8);pointer-events:none;animation:gpSpark 3.4s ease-in-out infinite}
.gp-spark:nth-of-type(1){left:15%;animation-delay:.2s}
.gp-spark:nth-of-type(2){left:49%;animation-delay:1.4s}
.gp-spark:nth-of-type(3){left:83%;animation-delay:2.3s}
.gp-close{position:absolute;right:10px;top:10px;width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:21px;line-height:1;cursor:pointer;transition:transform .2s,background .2s;z-index:2}
.gp-close:hover{transform:rotate(90deg);background:rgba(255,255,255,.16)}
.gp-logo-wrap{position:relative;width:92px;height:92px;display:grid;place-items:center;margin-bottom:2px}
.gp-logo-aura{position:absolute;inset:6px;border-radius:999px;background:rgba(34,197,94,.32);filter:blur(6px);animation:gpAura 2.8s ease-in-out infinite}
.gp-logo{position:relative;width:68px;height:68px;border-radius:999px;object-fit:cover;border:2.5px solid rgba(187,247,208,.6);box-shadow:0 16px 40px rgba(34,197,94,.38),inset 0 1px 0 rgba(255,255,255,.28);animation:gpLogo 2.8s ease-in-out infinite;background:#04352a}
.gp-title{margin:14px 0 4px;font-size:25px;font-weight:900;letter-spacing:.3px;line-height:1.25;background:linear-gradient(135deg,#fff 20%,#bbf7d0 70%,#fde68a);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.gp-divider{display:flex;align-items:center;gap:7px;margin:2px 0 10px;color:#fde68a;animation:gpDivider 3.2s ease-in-out infinite}
.gp-divider::before,.gp-divider::after{content:"";height:1px;width:34px;background:linear-gradient(90deg,transparent,rgba(253,230,138,.75));}
.gp-divider::after{background:linear-gradient(90deg,rgba(253,230,138,.75),transparent)}
.gp-card p{margin:0;color:#d1fae5;font-size:13px;line-height:1.75;max-width:296px}
.gp-card p strong{color:#fde68a;font-weight:900}
.gp-cta{position:relative;overflow:hidden;width:100%;max-width:280px;margin-top:18px;padding:13px 16px;border:1px solid rgba(134,239,172,.55);border-radius:15px;background:linear-gradient(135deg,#22c55e 0%,#166534 55%,#14532d 100%);color:#fff;font-size:15px;font-weight:900;letter-spacing:.2px;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 14px 34px rgba(5,46,22,.45),inset 0 1px 0 rgba(255,255,255,.24);cursor:pointer;animation:gpCtaLift 2.8s ease-in-out infinite;transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s}
.gp-cta:hover{box-shadow:0 18px 44px rgba(5,46,22,.55)}
.gp-cta:active{transform:scale(.985)}
.gp-cta::after{content:"";position:absolute;top:0;bottom:0;left:0;width:34%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);animation:gpShine 3.2s ease-in-out infinite;pointer-events:none}
.gp-trust{margin-top:12px;display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:#a7f3d0;animation:gpTrust 2.8s ease-in-out infinite}
.gp-trust .gp-tick{display:grid;place-items:center;width:15px;height:15px;border-radius:999px;background:rgba(34,197,94,.28);border:1px solid rgba(134,239,172,.5);color:#bbf7d0;font-size:10px;font-weight:900}
.gp-closing .gp-backdrop{opacity:0;transition:opacity .22s ease}
.gp-closing .gp-card{opacity:0;transform:scale(.96);transition:opacity .22s ease,transform .22s ease}
@media (max-width:400px){.gp-card{padding:22px 16px 18px}.gp-title{font-size:21px;margin:12px 0 4px}.gp-card p{font-size:12px}.gp-logo-wrap{width:82px;height:82px}.gp-logo{width:60px;height:60px}}
@media (max-height:560px){.gp-card{aspect-ratio:auto;height:auto}}
@media (prefers-reduced-motion:reduce){.gp-popup,.gp-card,.gp-card::after,.gp-logo,.gp-logo-aura,.gp-cta,.gp-cta::after,.gp-spark,.gp-card::before,.gp-divider,.gp-trust{animation:none!important}}
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
          <span className="gp-ring" aria-hidden="true" />
          <button type="button" className="gp-close" onClick={close} aria-label="বন্ধ করুন">×</button>
          <div className="gp-logo-wrap">
            <span className="gp-logo-aura" aria-hidden="true" />
            {logo && <img className="gp-logo" src={logo} alt={brand} width={68} height={68} />}
          </div>
          <h2 className="gp-title">গ্যারান্টি কার্ড</h2>
          <span className="gp-divider" aria-hidden="true">✦</span>
          <p>আমাদের কাছ থেকে বীজ কিনলেই পাবেন <strong>গ্যারান্টি কার্ড</strong> এবং বীজ থেকে চারা তৈরির সম্পূর্ণ গাইডলাইন</p>
          <button type="button" className="gp-cta" onClick={close}>
            <span>এখনই অর্ডার করুন</span>
            <span aria-hidden="true">→</span>
          </button>
          <span className="gp-trust"><span className="gp-tick" aria-hidden="true">✓</span> ১০০% অরিজিনাল বীজের নিশ্চয়তা</span>
        </div>
      </div>
    </>
  );
}
