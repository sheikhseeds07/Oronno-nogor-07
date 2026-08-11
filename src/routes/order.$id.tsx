import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { getPublicOrder } from "@/lib/public-order.functions";
import { taka, bnDigits } from "@/lib/format";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/order/$id")({ component: OrderPage });

const statusBn: Record<string, string> = {
  web_pending: "ওয়েব পেন্ডিং", pending: "অপেক্ষমাণ", confirmed: "কনফার্মড", processing: "প্রস্তুত হচ্ছে",
  rts: "RTS", shipped: "ডেলিভারিতে", delivered: "ডেলিভারি সম্পন্ন", cancelled: "বাতিল", returned: "ফেরত", hold: "হোল্ড",
};

function OrderPage() {
  const { id } = useParams({ from: "/order/$id" });
  const fetchOrder = useServerFn(getPublicOrder);
  const { data: order } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder({ data: { id } }),
  });

  if (!order) return <SiteLayout><div className="container mx-auto px-3 py-12 text-center">অর্ডার পাওয়া যায়নি</div></SiteLayout>;

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-6 max-w-2xl">
        <div className="bg-white border rounded-xl p-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-brand mx-auto mb-3" />
          <h1 className="text-2xl font-bold">অর্ডার সফল হয়েছে!</h1>
          <p className="text-muted-foreground mt-2">অর্ডার নং: <strong>#{order.id.slice(0, 8).toUpperCase()}</strong></p>
          <p className="mt-1">স্ট্যাটাস: <span className="font-bold text-brand-dark">{statusBn[order.status] ?? order.status}</span></p>
        </div>

        <div className="bg-white border rounded-xl p-5 mt-4">
          <h3 className="font-bold mb-3">অর্ডারের বিবরণ</h3>
          <div className="space-y-2">
            {order.order_items?.map((i: { id: string; product_name: string; quantity: number; price: number; subtotal: number }) => (
              <div key={i.id} className="flex justify-between text-sm py-2 border-b">
                <div>{i.product_name} × {bnDigits(i.quantity)}</div>
                <div className="font-bold">{taka(i.subtotal)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>সাবটোটাল</span><span>{taka(order.subtotal)}</span></div>
            <div className="flex justify-between"><span>ডেলিভারি</span><span>{taka(order.delivery_fee)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t pt-2"><span>মোট</span><span className="text-brand-dark">{taka(order.total)}</span></div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5 mt-4 text-sm">
          <h3 className="font-bold mb-2">ডেলিভারি ঠিকানা</h3>
          <p>{order.customer_name} — {order.customer_phone}</p>
          <p className="text-muted-foreground mt-1">{[order.thana, order.district].filter(Boolean).join(", ")}</p>
        </div>

        <Link to="/shop" className="mt-4 block text-center bg-brand text-white py-3 rounded-lg font-bold">আরও কেনাকাটা করুন</Link>
      </div>
    </SiteLayout>
  );
}
