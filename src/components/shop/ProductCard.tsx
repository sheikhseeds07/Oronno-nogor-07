import { ShoppingCart, Minus, Plus, Check, Sparkles } from "lucide-react";
import { memo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { taka, bnDigits } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { trackAddToCart } from "@/lib/fbq";
import { toImg, imgSrcSet } from "@/lib/img";
import { ProductQuickView } from "./ProductQuickView";

export type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  images: string[] | null;
  stock: number;
  description?: string;
  short_description?: string;
};

export const ProductCard = memo(function ProductCard({ p }: { p: Product }) {
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const inCart = useCart((s) => s.items.find((i) => i.id === p.id));
  const [open, setOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const price = p.sale_price ?? p.price;
  const discount = p.sale_price ? Math.round(((p.price - p.sale_price) / p.price) * 100) : 0;
  const img = p.images?.[0] || "/placeholder.svg";

  const addItem = () => {
    add({ id: p.id, name: p.name, slug: p.slug, price, image: img, stock: p.stock });
    trackAddToCart({ id: p.id, name: p.name, price, quantity: 1 });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  };

  return (
    <>
      <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_5px_18px_-14px_rgba(20,83,45,.5)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_12px_28px_-16px_rgba(20,83,45,.42)]">
        <button onClick={() => setOpen(true)} className="relative block aspect-square w-full overflow-hidden bg-muted text-left" aria-label={`${p.name} বিস্তারিত দেখুন`}>
          <img src={toImg(img, { w: 500, q: 78 })} srcSet={imgSrcSet(img, [200, 400, 600])} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px" alt={p.name} width={500} height={500} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.045]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          {discount > 0 && <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-lg bg-destructive px-2 py-1 text-[10px] font-extrabold text-white shadow-sm sm:left-2 sm:top-2 sm:text-xs"><Sparkles className="h-3 w-3" /> -{discount}%</span>}
          {p.stock > 0 && p.stock <= 5 && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-white/92 px-2 py-0.5 text-[9px] font-bold text-brand-dark shadow-sm backdrop-blur">শেষ {bnDigits(p.stock)} টি</span>}
          {p.stock <= 0 && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-extrabold text-white backdrop-blur-[1px]">স্টক নেই</span>}
        </button>

        <div className="flex flex-1 flex-col p-2 sm:p-2.5">
          <Link to="/product/$slug" params={{ slug: p.slug }} className="text-left">
            <h3 className="line-clamp-2 min-h-[2.3rem] text-[12px] font-bold leading-[1.45] text-foreground transition-colors group-hover:text-brand sm:text-sm">{p.name}</h3>
          </Link>

          <div className="mt-1.5 flex items-baseline justify-center gap-1.5 text-center">
            <span className="text-[17px] font-extrabold leading-none tracking-tight text-brand-dark sm:text-lg">{taka(price)}</span>
            {p.sale_price && p.sale_price < p.price && <span className="text-[10px] leading-none text-muted-foreground line-through sm:text-xs">{taka(p.price)}</span>}
          </div>

          <div className="mt-2.5">
            {inCart ? (
              <div className="flex h-9 items-center justify-between overflow-hidden rounded-xl border-2 border-brand bg-brand/5 shadow-[0_3px_10px_-7px_rgba(20,83,45,.55)]">
                <button onClick={() => (inCart.quantity <= 1 ? remove(p.id) : setQty(p.id, inCart.quantity - 1))} className="flex h-full w-9 items-center justify-center text-brand transition-colors hover:bg-brand-light/70 active:scale-90" aria-label="কমান"><Minus className="h-3.5 w-3.5" /></button>
                <span className="text-xs font-extrabold text-brand-dark">{bnDigits(inCart.quantity)}</span>
                <button onClick={() => setQty(p.id, Math.min(inCart.quantity + 1, p.stock || 999))} className="flex h-full w-9 items-center justify-center text-brand transition-colors hover:bg-brand-light/70 active:scale-90" aria-label="বাড়ান"><Plus className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <button
                disabled={p.stock <= 0}
                onClick={addItem}
                className={`group/cart relative flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border text-[11px] font-extrabold tracking-[-0.01em] transition-all duration-300 active:scale-[.975] disabled:cursor-not-allowed disabled:opacity-45 sm:h-10 sm:text-xs ${justAdded
                  ? "border-brand bg-brand text-white shadow-[0_7px_18px_-9px_rgba(20,83,45,.8)]"
                  : "border-brand/60 bg-gradient-to-r from-brand via-brand to-brand-dark text-white shadow-[0_6px_16px_-10px_rgba(20,83,45,.9)] hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_10px_22px_-10px_rgba(20,83,45,.9)]"
                }`}
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover/cart:translate-x-full" />
                <span className={`relative flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 transition-all duration-300 ${justAdded ? "scale-110 bg-white/15" : "group-hover/cart:scale-110 group-hover/cart:bg-white/15"}`}>
                  {justAdded ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5 transition-transform duration-300 group-hover/cart:-rotate-6" />}
                </span>
                <span className="relative">{justAdded ? "কার্টে যোগ হয়েছে" : "কার্টে যোগ করুন"}</span>
              </button>
            )}
          </div>
        </div>
      </article>
      {open && <ProductQuickView product={p} onClose={() => setOpen(false)} />}
    </>
  );
});
