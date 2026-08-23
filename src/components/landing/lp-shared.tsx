import { useEffect, useState } from "react";
import { Check, ShieldCheck, ShoppingCart, User, Phone, MapPin, Wallet } from "lucide-react";
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
.lp-product-checkout-group{border:1px solid #dfeae2;border-radius:18px;background:#fff;overflow:hidden}
.lp-product-checkout-group .lp-checkout-shell{border-top:1px solid #dfeae2}
.lp-product-checkout-group .lp-inline-selector{padding:8px 10px;margin:0;border:0;border-bottom:1px solid #edf3ee;background:#fff;border-radius:0}
.lp-product-checkout-group .lp-inline-summary{border:0;border-top:1px solid #edf3ee;border-radius:0}
.lp-product-checkout-group .lp-inline-summary>div{padding-top:7px;padding-bottom:7px}
.lp-order-note{display:flex;align-items:center;gap:8px;justify-content:center;text-align:left;background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1px solid #bbf7d0;border-radius:14px;padding:9px 12px;font-size:12px;font-weight:600;color:#14532d;line-height:1.5;box-shadow:0 4px 14px -10px rgba(6,78,59,.5)}
.lp-order-note svg{color:#16a34a;flex:0 0 auto}
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
  return <div style={{ marginBottom: 0, bottom: 0 }} className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${formInView ? "bg-transparent px-3 pt-1 pb-[calc(env(safe-area-inset-bottom,0px)+2px)] pointer-events-none" : "bg-white/95 backdrop-blur border-t border-emerald-100 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+2px)]"}`}>
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

export function LpOrderNote({ text = "নিশ্চিন্তে অর্ডার করুন। অর্ডার করার পরে আমরা আপনাকে কল দিয়ে বিস্তারিত বলে কনফার্ম করবো।" }: { text?: string }) {
  return <div className="lp-order-note"><ShieldCheck className="w-4 h-4" /><span>{text}</span></div>;
}

export type LpCheckoutValues = { name: string; phone: string; address: string };

export function LpCheckoutCard({ formId, onSubmit, values, onChange, packages, selectedPkg, onSelectPkg, themeColor, subtotal, deliveryFee, total, submitting, submitText = "অর্ডার কনফার্ম করুন", packageTitle = "প্যাকেজ সিলেক্ট করুন" }: {
  formId: string; onSubmit: (e: React.FormEvent) => void; values: LpCheckoutValues; onChange: (k: keyof LpCheckoutValues, v: string) => void;
  packages: LpPackage[]; selectedPkg: number; onSelectPkg: (i: number) => void; themeColor: string;
  subtotal: number; deliveryFee: number; total: number; submitting: boolean; submitText?: string; packageTitle?: string;
}) {
  const themeBg10 = themeColor + "1A";
  const inputCls = "w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-slate-50/60 outline-none focus:bg-white focus:border-emerald-500 transition";
  return <div className="lp-product-checkout-group"><div className="lp-checkout-shell rounded-2xl bg-white overflow-hidden">
    <form id={formId} onSubmit={onSubmit} className="p-3 sm:p-4 space-y-3">
      <div><label className="text-[13px] font-semibold text-slate-900 block mb-1.5">আপনার নাম</label><div className="relative"><User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input required value={values.name} onChange={e => onChange("name", e.target.value)} placeholder="আপনার নাম" className={inputCls} /></div></div>
      <div><label className="text-[13px] font-semibold text-slate-900 block mb-1.5">ফোন নম্বর</label><div className="relative"><Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input required type="tel" value={values.phone} onChange={e => onChange("phone", e.target.value)} placeholder="01XXXXXXXXX" className={inputCls} /></div></div>
      <div><label className="text-[13px] font-semibold text-slate-900 block mb-1.5">ডেলিভারি ঠিকানা</label><div className="relative"><MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><textarea required rows={3} value={values.address} onChange={e => onChange("address", e.target.value)} placeholder="গ্রাম/এলাকা, থানা, জেলা" className={inputCls + " resize-none"} /></div></div>
      <LpPackageSelector packages={packages} selected={selectedPkg} onSelect={onSelectPkg} themeColor={themeColor} title={packageTitle} />
      <div className="lp-inline-selector"><div className="lp-inline-title">পেমেন্ট মাধ্যম</div><div className="lp-inline-options">
        <div className="lp-inline-option w-full flex items-center gap-2 border text-left bg-white" style={{ borderColor: themeColor, background: themeColor + "0D", boxShadow: `0 0 0 1px ${themeColor}` }}>
          <span className="grid place-items-center w-8 h-8 rounded-lg shrink-0" style={{ background: themeBg10, color: themeColor }}><Wallet className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0"><div className="lp-option-name font-semibold text-slate-900">ক্যাশ অন ডেলিভারি</div><div className="text-[10px] text-slate-500">পণ্য হাতে পেয়ে পেমেন্ট করুন</div></div>
          <span className="grid place-items-center w-4 h-4 rounded-full border-2 shrink-0" style={{ background: themeColor, borderColor: themeColor }}><Check className="w-2.5 h-2.5 text-white" strokeWidth={3} /></span>
        </div>
      </div></div>
      <div className="lp-inline-summary text-sm divide-y divide-slate-100 overflow-hidden">
        <div className="flex justify-between px-3.5"><span className="text-slate-500">সাবটোটাল</span><span className="font-semibold text-slate-900">{taka(subtotal)}</span></div>
        <div className="flex justify-between px-3.5"><span className="text-slate-500">ডেলিভারি ফি</span><span className="font-semibold text-slate-900">{deliveryFee === 0 ? "ফ্রি" : taka(deliveryFee)}</span></div>
        <div className="flex justify-between px-3.5 bg-emerald-50/60"><span className="font-bold text-slate-900">সর্বমোট</span><span className="font-bold text-[16px]" style={{ color: themeColor }}>{taka(total)}</span></div>
      </div>
      <button type="submit" disabled={submitting} style={{ background: themeColor }} className="w-full text-white py-4 rounded-xl font-extrabold text-[17px] disabled:opacity-60 transition hover:brightness-95 inline-flex items-center justify-center gap-2 shadow-lg"><ShieldCheck className="w-[18px] h-[18px]" />{submitting ? "অর্ডার হচ্ছে..." : `${submitText} — ${taka(total)}`}</button>
    </form>
  </div></div>;
}
