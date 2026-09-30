import { SafeImage } from "@/components/SafeImage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { useCart } from "@/lib/cart-store";
import { taka, bnDigits } from "@/lib/format";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toImg } from "@/lib/img";

export const Route = createFileRoute("/cart")({ component: Cart, head: () => ({ meta: [{ title: "কার্ট — Sheikh Seeds" }, { name: "robots", content: "noindex, nofollow" }] }) });

function Cart() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart((s) => s.subtotal());

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-6">
        <h1 className="text-2xl font-bold mb-4">আমার কার্ট</h1>
        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">কার্ট খালি আছে</p>
            <Link to="/shop" className="bg-brand text-white px-6 py-2.5 rounded-full font-semibold">শপিং করুন</Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <div className="space-y-3">
              {items.map((i) => (
                <div key={i.id} className="bg-white border rounded-xl p-3 flex gap-3">
                  <SafeImage src={toImg(i.image, { w: 160, q: 70 })} alt={i.name} width={80} height={80} loading="lazy" decoding="async" className="w-20 h-20 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <Link to="/product/$slug" params={{ slug: i.slug }} className="font-semibold hover:text-brand line-clamp-2">{i.name}</Link>
                    <div className="text-brand-dark font-bold mt-1">{taka(i.price)}</div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center border rounded">
                        <button onClick={() => setQty(i.id, i.quantity - 1)} className="px-2 py-1"><Minus className="w-3 h-3" /></button>
                        <span className="px-3 font-bold text-sm">{bnDigits(i.quantity)}</span>
                        <button onClick={() => setQty(i.id, i.quantity + 1)} className="px-2 py-1"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => remove(i.id)} className="text-destructive ml-auto"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white border rounded-xl p-4 h-fit lg:sticky lg:top-24">
              <h3 className="font-bold mb-3">অর্ডার সামারি</h3>
              <div className="flex justify-between text-sm py-1"><span>সাবটোটাল</span><span className="font-bold">{taka(subtotal)}</span></div>
              <div className="flex justify-between text-sm py-1"><span>ডেলিভারি</span><span className="text-muted-foreground">চেকআউটে</span></div>
              <div className="border-t my-2"></div>
              <div className="flex justify-between font-bold text-lg"><span>মোট</span><span className="text-brand-dark">{taka(subtotal)}</span></div>
              <Link to="/checkout" className="mt-4 block text-center bg-brand text-white py-3 rounded-lg font-bold hover:bg-brand-dark">চেকআউট করুন</Link>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
