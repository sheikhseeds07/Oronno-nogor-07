import { SafeImage } from "@/components/SafeImage";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, X, ShoppingBag, Truck, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { taka, bnDigits } from "@/lib/format";
import { toImg } from "@/lib/img";
import { useQuery } from "@tanstack/react-query";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
import { getDeliveryInfo } from "@/lib/delivery-rules";

const DEFAULT_MINIMUM_HOME_ORDER = 200;

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart((s) => s.subtotal());
  const { data: settingsRow } = useQuery(publicSiteSettingsQuery);
  const settings = (settingsRow?.settings ?? {}) as Record<string, unknown>;
  const minimumHomeOrder = Math.max(0, Math.floor(Number(settings.minimum_home_order ?? DEFAULT_MINIMUM_HOME_ORDER) || DEFAULT_MINIMUM_HOME_ORDER));
  const deliveryRules = (settingsRow?.settings?.delivery_rules ?? undefined) as Array<{ id: string; min_order: number; fee: number }> | undefined;
  const { delivery, total, freeRule, amountToFree } = getDeliveryInfo(subtotal, deliveryRules);
  const progressTarget = freeRule?.min_order ?? (delivery === 0 ? subtotal : 0);
  const progressPercent = progressTarget > 0 ? Math.min(100, Math.max(0, (subtotal / progressTarget) * 100)) : 100;
  const [minimumOpen, setMinimumOpen] = useState(false);
  const isHome = typeof window !== "undefined" && window.location.pathname === "/";
  const amountRemaining = Math.max(0, minimumHomeOrder - subtotal);

  useEffect(() => {
    if (!open) { setMinimumOpen(false); return; }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const goToCheckout = () => {
    if (isHome && subtotal < minimumHomeOrder) { setMinimumOpen(true); return; }
    onClose();
    window.location.href = "/checkout";
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="flex-1 bg-black/50 animate-fade-in" onClick={onClose} />
      <aside className="w-[92%] max-w-md bg-white h-full flex flex-col shadow-2xl animate-slide-in-right">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-br from-brand to-brand-dark text-white">
          <div className="flex items-center gap-2"><ShoppingBag className="w-5 h-5" /><div className="font-extrabold">আমার শপিং কার্ট ({bnDigits(items.length)})</div></div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20" aria-label="বন্ধ"><X className="w-5 h-5" /></button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center"><ShoppingBag className="w-14 h-14 text-muted-foreground/40 mb-3" /><p className="text-muted-foreground mb-4">আপনার কার্টে এখনো কোনো পণ্য নেই</p><Link to="/shop" onClick={onClose} className="bg-brand text-white px-6 py-2.5 rounded-full font-semibold">পণ্য ব্রাউজ করুন</Link></div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {items.map((i) => (
                <div key={i.id} className="bg-white border rounded-xl p-2.5 flex gap-2.5">
                  <SafeImage src={toImg(i.image, { w: 160, h: 160, q: 75 })} loading="lazy" decoding="async" alt={i.name} className="w-16 h-16 object-cover rounded-lg shrink-0 bg-white border" />
                  <div className="flex-1 min-w-0"><div className="font-semibold text-sm line-clamp-2">{i.name}</div><div className="text-brand-dark font-bold text-sm mt-0.5">{taka(i.price)}</div><div className="mt-1.5 flex items-center gap-2"><div className="flex items-center border rounded"><button onClick={() => (i.quantity <= 1 ? remove(i.id) : setQty(i.id, i.quantity - 1))} className="px-2 py-1" aria-label="কমান"><Minus className="w-3 h-3" /></button><span className="px-2.5 font-bold text-xs">{bnDigits(i.quantity)}</span><button onClick={() => setQty(i.id, i.quantity + 1)} className="px-2 py-1" aria-label="বাড়ান"><Plus className="w-3 h-3" /></button></div><button onClick={() => remove(i.id)} className="text-destructive ml-auto" aria-label="মুছুন"><Trash2 className="w-4 h-4" /></button></div></div>
                </div>
              ))}
            </div>

            <div className="border-t p-3 bg-muted/30">
              <div className={`rounded-xl border px-3 py-2 ${delivery === 0 ? "border-emerald-200 bg-emerald-50/70" : "border-brand/15 bg-gradient-to-r from-brand-light/50 via-white to-amber-50/50"}`}>
                <div className="flex items-center gap-2"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${delivery === 0 ? "bg-emerald-100 text-emerald-700" : "bg-white text-brand-dark shadow-sm"}`}>{delivery === 0 ? <Sparkles className="h-3 w-3" /> : <Truck className="h-3 w-3" />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2 text-[10px] font-black leading-none"><span className={delivery === 0 ? "text-emerald-700" : "text-slate-800"}>{delivery === 0 ? "ডেলিভারি চার্জ ফ্রি 🎉" : `আর মাত্র ${taka(amountToFree)} টাকার পণ্য নিলে ডেলিভারি চার্জ ফ্রি`}</span><span className="shrink-0 text-brand-dark">{taka(subtotal)} / {taka(progressTarget)}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80 shadow-inner"><div className="h-full rounded-full bg-gradient-to-r from-brand via-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,.3)] transition-[width] duration-500 ease-out" style={{ width: `${progressPercent}%` }} /></div></div></div>
              </div>
              <div className="mt-2 space-y-1.5"><div className="flex justify-between text-xs"><span className="text-muted-foreground">সাবটোটাল</span><span className="font-bold">{taka(subtotal)}</span></div><div className="flex justify-between text-xs"><span className="text-muted-foreground">ডেলিভারি</span><span className={delivery === 0 ? "font-bold text-emerald-700" : "font-semibold"}>{delivery === 0 ? "ফ্রি" : taka(delivery)}</span></div><div className="flex justify-between font-black text-base pt-1.5 border-t"><span>মোট</span><span className="text-brand-dark">{taka(total)}</span></div></div>
              <button type="button" onClick={goToCheckout} className="mt-2 block w-full text-center bg-gradient-to-r from-brand to-brand-dark text-white py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition active:scale-[.985]">চেকআউট করুন</button>
            </div>
          </>
        )}
      </aside>

      {minimumOpen && isHome && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-3 sm:px-4" role="dialog" aria-modal="true" aria-labelledby="minimum-order-title">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[3px] animate-fade-in" onClick={() => setMinimumOpen(false)} />
          <div className="relative w-full max-w-[350px] overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_24px_70px_-20px_rgba(15,23,42,.55)] animate-[homeMinPop_.34s_cubic-bezier(.16,1,.3,1)_both]">
            <style>{`@keyframes homeMinPop{0%{opacity:0;transform:translateY(12px)scale(.96)}100%{opacity:1;transform:none}}@keyframes homeMinGlow{0%,100%{transform:scale(.92);opacity:.45}50%{transform:scale(1.08);opacity:.8}}@media(prefers-reduced-motion:reduce){.home-min-motion{animation:none!important}}`}</style>
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-emerald-400 to-amber-400" />
            <button type="button" onClick={() => setMinimumOpen(false)} aria-label="পপআপ বন্ধ করুন" className="absolute right-2.5 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 active:scale-90"><X className="h-3.5 w-3.5" /></button>
            <div className="relative px-4 pb-4 pt-5 text-center sm:px-5 sm:pb-5">
              <div className="pointer-events-none absolute left-1/2 top-[-42px] h-28 w-28 -translate-x-1/2 rounded-full bg-brand/15 blur-2xl home-min-motion" style={{ animation: "homeMinGlow 2.8s ease-in-out infinite" }} />
              <div className="relative mx-auto mb-2.5 grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_9px_22px_-10px_rgba(20,83,45,.75)] ring-4 ring-brand/10"><ShoppingBag className="h-5 w-5" /><span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-400 text-[8px] font-black text-amber-950 shadow">৳</span></div>
              <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-brand/10 bg-brand-light/60 px-2 py-0.5 text-[8px] font-extrabold text-brand-dark"><ShieldCheck className="h-2.5 w-2.5" /> ন্যূনতম অর্ডার</div>
              <h3 id="minimum-order-title" className="whitespace-nowrap text-[16px] font-black tracking-tight text-slate-900 sm:text-[17px]">ন্যূনতম {taka(minimumHomeOrder)} টাকার পণ্য কিনতে হবে</h3>
              <p className="mx-auto mt-1 max-w-[315px] text-[10px] leading-4 text-slate-500">আমরা আপনাদের জন্য পাইকারি দামে পণ্য দিচ্ছি, তাই অর্ডারের জন্য ন্যূনতম {taka(minimumHomeOrder)} টাকার পণ্য নিতে হবে।</p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-left"><div className="text-[8px] font-bold text-slate-400">আপনার বর্তমান মোট</div><div className="mt-0.5 text-base font-black text-brand-dark">{taka(subtotal)}</div></div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-2.5 py-2 text-left"><div className="text-[8px] font-bold text-amber-700/70">আরও কিনতে হবে</div><div className="mt-0.5 text-base font-black text-amber-700">{taka(amountRemaining)}</div></div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-400 transition-[width] duration-500" style={{ width: `${Math.min(100, (subtotal / minimumHomeOrder) * 100)}%` }} /></div>
              <div className="mt-1 flex justify-between text-[8px] font-bold text-slate-400"><span>বর্তমান {taka(subtotal)}</span><span>ন্যূনতম {taka(minimumHomeOrder)}</span></div>

              <Link to="/shop" onClick={() => { setMinimumOpen(false); onClose(); }} className="group mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-brand-dark text-xs font-extrabold text-white shadow-[0_9px_22px_-11px_rgba(20,83,45,.8)] transition hover:-translate-y-0.5 hover:shadow-[0_13px_26px_-11px_rgba(20,83,45,.85)] active:scale-[.98]">আরও কিছু কিনতে চাই <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></Link>
              <button type="button" onClick={() => setMinimumOpen(false)} className="mt-1 h-7 px-3 text-[10px] font-bold text-slate-400 transition hover:text-slate-700">পরে করবো</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
