import { ShoppingCart, Minus, Plus, Check } from "lucide-react";
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
      <div className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition flex flex-col">
        <button onClick={() => setOpen(true)} className="block relative aspect-square bg-muted overflow-hidden text-left">
          <img
            src={toImg(img, { w: 400, q: 75 })}
            srcSet={imgSrcSet(img, [200, 400, 600])}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
            alt={p.name}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition"
          />
          {discount > 0 && (
            <span className="absolute top-2 left-2 bg-destructive text-white text-xs font-bold px-2 py-1 rounded">
              -{discount}%
            </span>
          )}
          {p.stock <= 0 && (
            <span className="absolute inset-0 bg-black/50 text-white flex items-center justify-center font-bold">স্টক নেই</span>
          )}
        </button>
        <div className="p-3 flex flex-col flex-1">
          <Link to="/product/$slug" params={{ slug: p.slug }} className="text-left">
            <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] hover:text-brand">{p.name}</h3>
          </Link>
          <div className="mt-2 flex items-baseline justify-center gap-2">
            <span className="text-brand-dark font-extrabold text-lg sm:text-xl tracking-tight leading-none">{taka(price)}</span>
            {p.sale_price && p.sale_price < p.price && (
              <span className="text-xs text-muted-foreground line-through leading-none">{taka(p.price)}</span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {inCart ? (
              <div className="flex items-center justify-between border-2 border-brand rounded-md overflow-hidden">
                <button
                  onClick={() => (inCart.quantity <= 1 ? remove(p.id) : setQty(p.id, inCart.quantity - 1))}
                  className="px-3 py-2 text-brand hover:bg-brand-light/50"
                  aria-label="কমান"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-extrabold text-brand-dark text-sm">{bnDigits(inCart.quantity)}</span>
                <button
                  onClick={() => setQty(p.id, Math.min(inCart.quantity + 1, p.stock || 999))}
                  className="px-3 py-2 text-brand hover:bg-brand-light/50"
                  aria-label="বাড়ান"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                disabled={p.stock <= 0}
                onClick={addItem}
                className={`flex items-center justify-center gap-1.5 border py-2 rounded-md text-xs font-bold transition-colors disabled:opacity-50 ${justAdded ? "border-brand bg-brand text-white" : "border-brand text-brand hover:bg-brand-light/50"}`}
              >
                {justAdded ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                {justAdded ? "কার্টে যোগ হয়েছে" : "কার্টে যোগ করুন"}
              </button>
            )}
          </div>
        </div>
      </div>
      {open && (
        <ProductQuickView product={p} onClose={() => setOpen(false)} />
      )}
    </>
  );
});
