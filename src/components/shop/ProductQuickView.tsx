import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { X, Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { taka, bnDigits } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { toastAddedToCart } from "@/lib/cart-toast";
import type { Product } from "./ProductCard";
import { trackAddToCart, trackViewContent } from "@/lib/fbq";
import { toImg, imgSrcSet } from "@/lib/img";

export function ProductQuickView({ product, onClose }: { product: Product & { description?: string; short_description?: string }; onClose: () => void }) {
  const add = useCart((s) => s.add);
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const price = product.sale_price ?? product.price;
  const discount = product.sale_price ? Math.round(((product.price - product.sale_price) / product.price) * 100) : 0;
  const img = product.images?.[0] || "/placeholder.svg";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    trackViewContent({ id: product.id, name: product.name, price });
    return () => { document.body.style.overflow = previousOverflow; };
  }, [product.id, product.name, price]);

  const addItem = () => {
    add({ id: product.id, name: product.name, slug: product.slug, price, image: img, stock: product.stock }, qty);
    trackAddToCart({ id: product.id, name: product.name, price, quantity: qty });
  };

  const handleAdd = () => {
    addItem();
    toastAddedToCart(product.name);
    onClose();
  };

  const handleOrderNow = () => {
    addItem();
    onClose();
    navigate({ to: "/checkout" });
  };

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center animate-fade-in" role="dialog" aria-modal="true" aria-label={product.name}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-muted"
          aria-label="বন্ধ করুন"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid sm:grid-cols-2">
          <div className="relative bg-muted aspect-square sm:aspect-auto sm:h-full">
            <img src={toImg(img, { w: 600, q: 78 })} srcSet={imgSrcSet(img, [400, 600, 800])} sizes="(max-width: 640px) 100vw, 400px" decoding="async" alt={product.name} className="w-full h-full object-cover sm:rounded-l-2xl" />
            {discount > 0 && (
              <span className="absolute top-3 left-3 bg-destructive text-white text-xs font-bold px-2.5 py-1 rounded-full">
                -{discount}%
              </span>
            )}
          </div>

          <div className="p-4 sm:p-6 flex flex-col gap-3">
            <h2 className="text-base sm:text-lg font-bold leading-snug">{product.name}</h2>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-brand-dark">{taka(price)}</span>
              {product.sale_price && <span className="text-sm text-muted-foreground line-through">{taka(product.price)}</span>}
            </div>

            <div className="text-sm text-muted-foreground leading-relaxed">
              {product.description || product.short_description || "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।"}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-sm font-semibold">পরিমাণ:</span>
              <div className="flex items-center border rounded-full">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-l-full">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-bold">{bnDigits(qty)}</span>
                <button onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))} className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-r-full">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <span className={`text-xs font-semibold ${product.stock > 0 ? "text-emerald-600" : "text-destructive"}`}>
                {product.stock > 0 ? "স্টকে আছে" : "স্টক নেই"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 mt-auto">
              <button
                onClick={handleAdd}
                disabled={product.stock <= 0}
                className="flex items-center justify-center gap-1.5 border-2 border-brand text-brand py-2.5 rounded-lg text-sm font-bold hover:bg-brand-light/50 disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4" /> কার্টে যোগ
              </button>
              <button
                onClick={handleOrderNow}
                disabled={product.stock <= 0}
                className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-brand to-brand-dark text-white py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" /> এখনই অর্ডার
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
