import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Minus, Plus, Trash2, X, ShoppingBag, Truck, Sparkles } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { taka, bnDigits } from "@/lib/format";
import { toImg } from "@/lib/img";
import { useQuery } from "@tanstack/react-query";
import { publicSiteSettingsQuery } from "@/lib/site-settings-query";
import { getDeliveryInfo } from "@/lib/delivery-rules";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart((s) => s.subtotal());
  const { data: settingsRow } = useQuery(publicSiteSettingsQuery);
  const deliveryRules = (settingsRow?.settings?.delivery_rules ?? undefined) as Array<{ id: string; min_order: number; fee: number }> | undefined;
  const { delivery, total, freeRule, amountToFree } = getDeliveryInfo(subtotal, deliveryRules);
  const progressTarget = freeRule?.min_order ?? (delivery === 0 ? subtotal : 0);
  const progressPercent = progressTarget > 0 ? Math.min(100, Math.max(0, (subtotal / progressTarget) * 100)) : 100;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="flex-1 bg-black/50 animate-fade-in" onClick={onClose} />
      <aside className="w-[92%] max-w-md bg-white h-full flex flex-col shadow-2xl animate-slide-in-right">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-br from-brand to-brand-dark text-white">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            <div className="font-extrabold">আমার শপিং কার্ট ({bnDigits(items.length)})</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20" aria-label="বন্ধ">
            <X className="w-5 h-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <ShoppingBag className="w-14 h-14 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground mb-4">আপনার কার্টে এখনো কোনো পণ্য নেই</p>
            <Link to="/shop" onClick={onClose} className="bg-brand text-white px-6 py-2.5 rounded-full font-semibold">
              পণ্য ব্রাউজ করুন
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {items.map((i) => (
                <div key={i.id} className="bg-white border rounded-xl p-2.5 flex gap-2.5">
                  <img src={toImg(i.image, { w: 160, h: 160, q: 75 })} loading="lazy" decoding="async" alt={i.name} className="w-16 h-16 object-cover rounded-lg shrink-0 bg-white border" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm line-clamp-2">{i.name}</div>
                    <div className="text-brand-dark font-bold text-sm mt-0.5">{taka(i.price)}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex items-center border rounded">
                        <button onClick={() => (i.quantity <= 1 ? remove(i.id) : setQty(i.id, i.quantity - 1))} className="px-2 py-1" aria-label="কমান"><Minus className="w-3 h-3" /></button>
                        <span className="px-2.5 font-bold text-xs">{bnDigits(i.quantity)}</span>
                        <button onClick={() => setQty(i.id, i.quantity + 1)} className="px-2 py-1" aria-label="বাড়ান"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => remove(i.id)} className="text-destructive ml-auto" aria-label="মুছুন"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t p-3 bg-muted/30">
              <div className={`rounded-xl border px-3 py-2 ${delivery === 0 ? "border-emerald-200 bg-emerald-50/70" : "border-brand/15 bg-gradient-to-r from-brand-light/50 via-white to-amber-50/50"}`}>
                <div className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${delivery === 0 ? "bg-emerald-100 text-emerald-700" : "bg-white text-brand-dark shadow-sm"}`}>
                    {delivery === 0 ? <Sparkles className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black leading-none">
                      <span className={delivery === 0 ? "text-emerald-700" : "text-slate-800"}>
                        {delivery === 0 ? "ডেলিভারি চার্জ ফ্রি 🎉" : `আর মাত্র ${taka(amountToFree)} টাকার পণ্য নিলে ডেলিভারি চার্জ ফ্রি`}
                      </span>
                      <span className="shrink-0 text-brand-dark">{taka(subtotal)} / {taka(progressTarget)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80 shadow-inner">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand via-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,.3)] transition-[width] duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">সাবটোটাল</span><span className="font-bold">{taka(subtotal)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">ডেলিভারি</span><span className={delivery === 0 ? "font-bold text-emerald-700" : "font-semibold"}>{delivery === 0 ? "ফ্রি" : taka(delivery)}</span></div>
                <div className="flex justify-between font-black text-base pt-1.5 border-t"><span>মোট</span><span className="text-brand-dark">{taka(total)}</span></div>
              </div>
              <Link to="/checkout" onClick={onClose} className="mt-2 block text-center bg-gradient-to-r from-brand to-brand-dark text-white py-2.5 rounded-lg font-bold text-sm hover:opacity-90">
                চেকআউট করুন
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
