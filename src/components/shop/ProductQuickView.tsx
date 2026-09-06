import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, Minus, Plus, ShoppingCart, Zap, PackageCheck, Star, MessageCircle, FileText, ChevronRight } from "lucide-react";
import { taka, bnDigits } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { toastAddedToCart } from "@/lib/cart-toast";
import type { Product } from "./ProductCard";
import { trackAddToCart, trackViewContent } from "@/lib/fbq";
import { toImg, imgSrcSet } from "@/lib/img";
import { ProductTabs } from "@/components/community/ProductTabs";
import { db } from "@/lib/customer-account";

function isUuid(v: unknown) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function ProductQuickView({ product, onClose }: { product: Product & { description?: string; short_description?: string }; onClose: () => void }) {
  const add = useCart((s) => s.add);
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [activeSection, setActiveSection] = useState<"desc" | "reviews" | "qa">("desc");
  const price = product.sale_price ?? product.price;
  const discount = product.sale_price ? Math.round(((product.price - product.sale_price) / product.price) * 100) : 0;
  const img = product.images?.[0] || "/placeholder.svg";

  const reviewsQ = useQuery({
    queryKey: ["quick-view-review-count", product.id],
    enabled: isUuid(product.id),
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await db.from("product_reviews").select("id", { count: "exact", head: true }).eq("product_id", product.id).eq("status", "approved");
      return count ?? 0;
    },
  });
  const questionsQ = useQuery({
    queryKey: ["quick-view-question-count", product.id],
    enabled: isUuid(product.id),
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await db.from("product_questions").select("id", { count: "exact", head: true }).eq("product_id", product.id).eq("status", "approved");
      return count ?? 0;
    },
  });

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

  const selectSection = (section: "desc" | "reviews" | "qa") => {
    setActiveSection(section);
    requestAnimationFrame(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const buttons = dialog ? Array.from(dialog.querySelectorAll("button")) : [];
      const target = section === "desc" ? "বিবরণ" : section === "reviews" ? "রিভিউ" : "প্রশ্ন";
      const button = buttons.find((b) => b.textContent?.trim().startsWith(target));
      button?.click();
      const community = dialog?.querySelector("[data-community-tabs]");
      community?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const navItems = [
    { id: "desc" as const, icon: FileText, label: "বিবরণ" },
    { id: "reviews" as const, icon: Star, label: "রিভিউ", count: reviewsQ.data ?? 0 },
    { id: "qa" as const, icon: MessageCircle, label: "জিজ্ঞাসা", count: questionsQ.data ?? 0 },
  ];

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={product.name}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] bg-background shadow-[0_30px_100px_rgba(0,0,0,.28)] animate-scale-in sm:max-h-[92vh] sm:rounded-[28px]">
        <div className="sticky top-0 z-30 border-b bg-background/95 px-3 pt-2 backdrop-blur-xl sm:px-5">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted sm:hidden" />
          <div className="flex items-center gap-1 rounded-2xl bg-muted/55 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button key={item.id} type="button" onClick={() => selectSection(item.id)} className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-extrabold transition-all sm:text-sm ${active ? "bg-background text-brand-dark shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className={`h-4 w-4 ${active && item.id === "reviews" ? "fill-amber-400 text-amber-400" : ""}`} />
                  <span>{item.label}</span>
                  {item.count !== undefined && <span className={`min-w-4 rounded-full px-1 text-[10px] ${active ? "bg-brand-light text-brand-dark" : "bg-background/80"}`}>{bnDigits(item.count)}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="grid sm:grid-cols-[.9fr_1.1fr]">
            <div className="relative aspect-square overflow-hidden bg-muted sm:aspect-auto sm:min-h-[390px]">
              <img src={toImg(img, { w: 800, q: 82 })} srcSet={imgSrcSet(img, [400, 600, 800])} sizes="(max-width: 640px) 100vw, 420px" decoding="async" alt={product.name} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent" />
              {discount > 0 && <span className="absolute left-3 top-3 rounded-full bg-destructive px-3 py-1.5 text-xs font-black text-white shadow-lg">{discount}% ছাড়</span>}
              <button onClick={onClose} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-lg backdrop-blur transition hover:scale-105 active:scale-95" aria-label="বন্ধ করুন"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex flex-col p-4 sm:p-6">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-muted-foreground"><PackageCheck className="h-4 w-4 text-brand" /> AB Seed · প্রিমিয়াম বীজ</div>
              <Link to="/product/$slug" params={{ slug: product.slug }} onClick={onClose} className="text-xl font-black leading-tight tracking-tight text-foreground transition hover:text-brand-dark sm:text-2xl">{product.name}</Link>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-600"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> 5.0</span>
                <button type="button" onClick={() => selectSection("reviews")} className="text-xs font-bold text-muted-foreground underline underline-offset-2">({bnDigits(reviewsQ.data ?? 0)}টি রিভিউ)</button>
              </div>

              <div className="mt-4 flex items-end gap-2">
                <span className="text-3xl font-black tracking-tight text-brand-dark">{taka(price)}</span>
                {product.sale_price && <span className="pb-1 text-sm font-semibold text-muted-foreground line-through">{taka(product.price)}</span>}
                {discount > 0 && <span className="mb-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-black text-destructive">{discount}% ছাড়</span>}
              </div>
              <div className="mt-1 text-xs font-bold text-brand-dark">৳৪ ক্যাশব্যাক</div>

              <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground">{product.description || product.short_description || "দ্রুত ফলন, দীর্ঘ সময় ধরে সংগ্রহযোগ্য, সঠিক যত্নে চমৎকার ফলন পাওয়া যায়।"}</p>

              <div className="mt-4 flex items-center justify-between rounded-2xl border bg-muted/25 p-3">
                <div><div className={`flex items-center gap-1.5 text-sm font-extrabold ${product.stock > 0 ? "text-emerald-600" : "text-destructive"}`}><span className={`h-2 w-2 rounded-full ${product.stock > 0 ? "bg-emerald-500" : "bg-red-500"}`} />{product.stock > 0 ? "স্টকে আছে" : "স্টক নেই"}</div><div className="mt-1 text-xs text-muted-foreground">{product.stock > 0 ? "অর্ডার করলে দ্রুত পাঠানো হবে" : "শীঘ্রই স্টক আসবে"}</div></div>
                <div className="flex items-center overflow-hidden rounded-xl border bg-background shadow-sm">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-10 w-10 place-items-center transition hover:bg-muted" aria-label="কমাও"><Minus className="h-4 w-4" /></button>
                  <span className="grid h-10 min-w-10 place-items-center border-x px-2 text-sm font-black">{bnDigits(qty)}</span>
                  <button onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))} className="grid h-10 w-10 place-items-center transition hover:bg-muted" aria-label="বাড়াও"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-2 text-center text-xs font-bold text-muted-foreground">{bnDigits(qty)}টি কার্টে আছে</div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={handleAdd} disabled={product.stock <= 0} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-brand py-3 text-sm font-black text-brand transition hover:bg-brand-light/50 active:scale-[.98] disabled:opacity-50"><ShoppingCart className="h-4 w-4" /> কার্টে যোগ</button>
                <button onClick={handleOrderNow} disabled={product.stock <= 0} className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-brand-dark py-3 text-sm font-black text-white shadow-lg shadow-brand/20 transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"><Zap className="h-4 w-4" /> এখনই অর্ডার</button>
              </div>
              <Link to="/product/$slug" params={{ slug: product.slug }} onClick={onClose} className="mt-3 inline-flex items-center justify-center gap-1 text-xs font-extrabold text-brand-dark underline underline-offset-4 hover:text-brand">সম্পূর্ণ পণ্য পেজ দেখুন <ChevronRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>

          {isUuid(product.id) && <div data-community-tabs className="border-t bg-background px-3 pb-6 pt-1 sm:px-5"><ProductTabs productId={String(product.id)} description={product.description} /></div>}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
