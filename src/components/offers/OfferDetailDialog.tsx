import { SafeImage } from "@/components/SafeImage";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { X, BadgePercent, PackageCheck, Sparkles, Check } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";
import { taka, bnDigits } from "@/lib/format";

export type OfferDetail = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  images: string[];
  short_description: string | null;
};

type ComboItem = { id: string; quantity: number; name: string; price: number; image: string };

export function OfferDetailDialog({ offer, onClose }: { offer: OfferDetail | null; onClose: () => void }) {
  useEffect(() => {
    if (!offer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [offer, onClose]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["offer-combo-items", offer?.id],
    enabled: !!offer?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("offer_items") as any)
        .select("id,quantity,display_order,product:products!offer_items_product_id_fkey(name,price,sale_price,images)")
        .eq("offer_product_id", offer!.id)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        quantity: r.quantity ?? 1,
        name: r.product?.name ?? "",
        price: Number(r.product?.sale_price ?? r.product?.price ?? 0),
        image: r.product?.images?.[0] || "/placeholder.svg",
      })) as ComboItem[];
    },
  });

  if (!offer) return null;

  const offerPrice = offer.sale_price ?? offer.price;
  const itemsTotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const baseTotal = itemsTotal > offerPrice ? itemsTotal : offer.price;
  const save = Math.max(0, baseTotal - offerPrice);
  const percent = baseTotal > 0 ? Math.round((save / baseTotal) * 100) : 0;

  return (
    <div className="offer-modal-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={offer.name}>
      <div className="offer-modal-card relative w-full max-w-sm overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-[0_40px_90px_-40px_rgba(6,78,59,.75)]" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="বন্ধ করুন" className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md ring-1 ring-black/5 transition hover:scale-105 hover:bg-white active:scale-95">
          <X className="h-4 w-4" />
        </button>
        <div className="relative h-32 overflow-hidden bg-slate-100">
          <SafeImage src={offer.images?.[0] || "/placeholder.svg"} alt={offer.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
          <div className="absolute inset-x-3 bottom-2.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-black text-white backdrop-blur">
              <Sparkles className="h-3 w-3" /> কম্বো অফার
            </span>
            <h3 className="mt-1 line-clamp-2 text-[15px] font-black leading-tight tracking-tight text-white">{offer.name}</h3>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-brand-dark">{taka(offerPrice)}</span>
            {save > 0 && <span className="pb-1 text-xs font-bold text-muted-foreground line-through">{taka(baseTotal)}</span>}
            {percent > 0 && (
              <span className="mb-1 ml-auto inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-black text-brand-dark">
                <BadgePercent className="h-3 w-3" /> {bnDigits(percent)}% ছাড়
              </span>
            )}
          </div>
          {save > 0 && <p className="mt-1 text-[11px] font-bold text-brand">সঞ্চয় {taka(save)}</p>}

          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-black text-slate-700">
            <PackageCheck className="h-3.5 w-3.5 text-brand" /> এই কম্বোতে যা যা থাকছে
          </div>

          <div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {isLoading ? (
              <p className="py-6 text-center text-[11px] text-muted-foreground">লোড হচ্ছে...</p>
            ) : items.length === 0 ? (
              <p className="py-5 text-center text-[11px] text-muted-foreground">{offer.short_description || "বিস্তারিত তালিকা শীঘ্রই যোগ হবে"}</p>
            ) : (
              items.map((it, i) => (
                <div key={it.id} className="offer-item-row flex items-center gap-2.5 rounded-2xl border border-brand/10 bg-gradient-to-r from-white to-brand-light/30 p-2 shadow-[0_8px_20px_-18px_rgba(6,78,59,.7)] transition hover:-translate-y-0.5 hover:border-brand/30" style={{ animationDelay: `${i * 60}ms` }}>
                  <SafeImage src={it.image} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-black/5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-black text-slate-900">{it.name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground">{bnDigits(it.quantity)} টি × {taka(it.price)}</p>
                  </div>
                  <Check className="h-4 w-4 shrink-0 text-brand" />
                </div>
              ))
            )}
          </div>

          <button type="button" onClick={onClose} className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-4 py-3 text-xs font-black text-white shadow-[0_14px_30px_-14px_rgba(20,83,45,.9)] ring-1 ring-inset ring-white/25 transition hover:-translate-y-0.5 active:scale-[.98]">
            ঠিক আছে
          </button>
        </div>
      </div>
      <style>{`@keyframes offerModalIn{from{opacity:0;transform:translateY(16px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes offerFadeIn{from{opacity:0}to{opacity:1}}@keyframes offerRowIn{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}.offer-modal-backdrop{animation:offerFadeIn .22s ease both}.offer-modal-card{animation:offerModalIn .38s cubic-bezier(.2,.9,.25,1) both}.offer-item-row{animation:offerRowIn .4s cubic-bezier(.2,.9,.25,1) both}@media(prefers-reduced-motion:reduce){.offer-modal-backdrop,.offer-modal-card,.offer-item-row{animation:none}}`}</style>
    </div>
  );
}
