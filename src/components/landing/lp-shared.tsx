import { useEffect, useState } from "react";
import { Check, ShieldCheck, ShoppingCart } from "lucide-react";
import { toImg } from "@/lib/img";
import { taka } from "@/lib/format";

export const bnNum = (n: number | string) => String(n).replace(/[0-9]/g, d => "০১২৩৪৫৬৭৮৯"[Number(d)]);
export const bnTaka = (n: number) => "৳" + bnNum(Math.round(Number(n) || 0).toLocaleString("en-US"));

export const LP_SHARED_STYLE = `
.lp-hdr-timer{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.lp-hdr-timer-row{display:flex;align-items:center;gap:4px}
.lp-hdr-timer-note{font-size:9px;font-weight:800;color:#d97706;letter-spacing:.02em;line-height:1}
.lp-hdr-timer b{background:#1a8944;color:#fff;font-size:13px;font-weight:800;padding:3px 6px;border-radius:6px;min-width:28px;text-align:center;font-variant-numeric:tabular-nums;line-height:1.2;display:block}
.lp-hdr-timer i{font-style:normal;color:#1a8944;font-weight:800;font-size:13px}
.lp-hdr-timer em{font-style:normal;display:block;font-size:9px;color:#64748b;font-weight:700;text-align:center;margin-top:2px}
.lp-inline-selector{padding:8px 10px;margin:0;border:1px solid #dfeae2;border-radius:14px;background:#fff}
.lp-inline-title{font-size:11px;font-weight:800;color:#64748b;margin-bottom:6px}
.lp-inline-options{display:flex;flex-direction:column;gap:5px}
.lp-inline-option{min-height:48px;padding:6px 8px;border-radius:10px}
.lp-inline-option img{width:34px;height:34px;border-radius:8px;object-fit:cover}
.lp-inline-option .lp-option-name{font-size:12px;line-height:1.25}
.lp-inline-option .lp-option-price{font-size:13px}
@media (max-width:640px){.lp-inline-selector{padding:7px 8px}.lp-inline-option{min-height:46px;padding:5px 7px}}
.lp-confirm-cta{position:relative;overflow:hidden;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:14px 20px;border:0;border-radius:16px;font-size:17px;font-weight:800;letter-spacing:-.01em;color:#fff;cursor:pointer;background:linear-gradient(135deg,#047857 0%,#059669 45%,#10b981 100%);box-shadow:0 14px 34px -14px rgba(4,120,87,.75),0 2px 0 0 rgba(255,255,255,.18) inset;transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s ease,filter .18s ease;animation:lpConfirmRise .45s cubic-bezier(.22,1,.36,1) both}
.lp-confirm-cta::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:35%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.42),transparent);transform:skewX(-18deg);animation:lpConfirmShine 2.8s ease-in-out infinite}
.lp-confirm-cta:hover{transform:translateY(-2px);box-shadow:0 20px 40px -14px rgba(4,120,87,.8)}
.lp-confirm-cta:active{transform:translateY(0) scale(.985)}
.lp-confirm-cta:disabled{opacity:.65;cursor:not-allowed;animation:none}
.lp-confirm-cta:disabled::after{display:none}
.lp-confirm-amount{font-variant-numeric:tabular-nums}
@keyframes lpConfirmShine{0%{left:-40%}55%{left:120%}100%{left:120%}}
@keyframes lpConfirmRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion:reduce){.lp-confirm-cta,.lp-confirm-cta::after{animation:none}}
`;

export function LpHeaderCountdown({ hours = 3 }: { hours?: number }) {
  const secs = Math.max(1, Math.round((Number(hours) || 3) * 3600));
  const [left, setLeft] = useState(secs);
  useEffect(() => {
    const KEY = "lp-offer-deadline";
    let deadline = Number(localStorage.getItem(KEY) || 0);
    if (!deadline || deadline < Date.now()) { deadline = Date.now() + secs * 1000; localStorage.setItem(KEY, String(deadline)); }
    const tick = () => setLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [secs]);
  const pad = (n: number) => String(n).padStart(2, "0");
  const parts = [{ v: pad(Math.floor(left / 3600)), l: "ঘণ্টা" }, { v: pad(Math.floor((left % 3600) / 60)), l: "মিনিট" }, { v: pad(left % 60), l: "সেকেন্ড" }];
  return <div className="lp-hdr-timer shrink-0"><span className="lp-hdr-timer-note">⏳ অফার শেষ হতে বাকি</span><div className="lp-hdr-timer-row">{parts.map((p, i) => <div key={p.l} className="flex items-center gap-1">{i > 0 && <i>:</i>}<div><b>{p.v}</b><em>{p.l}</em></div></div>)}</div></div>;
}

export type LpPackage = { label?: string; name?: string; price: number; old?: number | null; image?: string; badge?: string };

export function LpPackageSelector({ packages, selected, onSelect, themeColor, title = "প্যাকেজ সিলেক্ট করুন" }: { packages: LpPackage[]; selected: number; onSelect: (i: number) => void; themeColor: string; title?: string }) {
  if (!packages.length) return null;
  const themeBg10 = themeColor + "1A";
  const themeBg05 = themeColor + "0D";
  return <div className="lp-inline-selector"><div className="lp-inline-title">{title}</div><div className="lp-inline-options">{packages.map((p, i) => {
    const active = selected === i;
    return <button type="button" key={i} onClick={() => onSelect(i)} className="lp-inline-option w-full flex items-center gap-2 border text-left transition bg-white" style={active ? { borderColor: themeColor, background: themeBg05, boxShadow: `0 0 0 1px ${themeColor}` } : { borderColor: "#dcece0" }}>
      {p.image && <img src={toImg(p.image)} alt="" width={34} height={34} loading="lazy" decoding="async" className="shrink-0 object-cover bg-slate-50" />}
      <div className="flex-1 min-w-0"><div className="lp-option-name font-semibold text-slate-900">{p.label || p.name}</div>{p.badge && <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: themeBg10, color: themeColor }}>{p.badge}</span>}</div>
      <div className="lp-option-price text-right font-bold text-slate-900 shrink-0">{taka(p.price)}</div>
      <span className="grid place-items-center w-4 h-4 rounded-full border-2 shrink-0" style={active ? { background: themeColor, borderColor: themeColor } : { borderColor: "#cbd5e1" }}>{active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}</span>
    </button>;
  })}</div></div>;
}

export function LpFloatingCta({ formInView, formId, submitting, total, subtotal, regular, productName, ctaText, themeColor, onScrollToOrder }: { formInView: boolean; formId: string; submitting: boolean; total: number; subtotal: number; regular?: number | null; productName: string; ctaText: string; themeColor: string; onScrollToOrder: () => void }) {
  return <div className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${formInView ? "bg-transparent px-3 pb-4 pt-1 pointer-events-none" : "bg-white/95 backdrop-blur border-t border-emerald-100 px-3 py-2.5"}`}>
    <div className="container mx-auto max-w-2xl">
      {!formInView ? <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="leading-tight min-w-0">
          <div className="text-[12px] font-bold text-slate-900 truncate">{productName}</div>
          <div className="flex items-baseline gap-1.5">{regular && regular > subtotal && <span className="text-[12px] line-through text-slate-400">{bnTaka(regular)}</span>}<span className="font-extrabold text-[17px]" style={{ color: themeColor }}>{bnTaka(subtotal)}</span></div>
        </div>
        <button onClick={onScrollToOrder} style={{ background: themeColor }} className="lp-pulse shrink-0 text-white px-6 py-3 rounded-xl font-extrabold text-[15px] flex items-center justify-center gap-2 transition hover:brightness-95"><ShoppingCart className="w-[18px] h-[18px]" />{ctaText}</button>
      </div> : <div className="pointer-events-auto">
        <button type="submit" form={formId} disabled={submitting} className="lp-confirm-cta"><ShieldCheck className="w-[18px] h-[18px]" />{submitting ? "অর্ডার হচ্ছে..." : <>অর্ডার টি কনফার্ম করুন <span className="lp-confirm-amount">{taka(total)}</span></>}</button>
      </div>}
    </div>
  </div>;
}
