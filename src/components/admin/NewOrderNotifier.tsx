import { useEffect } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { ShoppingBag, X } from "lucide-react";

export function NewOrderNotifier() {
  const navigate = useNavigate();

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});

    // Realtime: instant popup on every new order INSERT (no polling cost).
    const seen = new Set<string>();
    const show = async (row: any) => {
        

        // The INSERT payload can contain a stale/zero total. Read the authoritative
        // order + order_items after INSERT so the popup always shows the real price.
        let order: any = row;
        try {
          const [{ data: freshOrder }, { data: items }] = await Promise.all([
            supabase.from("orders").select("id,customer_name,customer_phone,total,subtotal,delivery_fee,discount").eq("id", row?.id).maybeSingle(),
            supabase.from("order_items").select("product_name,price,quantity,subtotal").eq("order_id", row?.id),
          ]);
          if (freshOrder) order = { ...row, ...freshOrder };
          if (Array.isArray(items)) order.items = items;
        } catch {
          // Keep the realtime row as a fallback.
        }

        const item = Array.isArray(order.items) && order.items.length ? order.items[0] : null;
        const itemCount = Array.isArray(order.items) ? order.items.reduce((sum: number, i: any) => sum + Number(i?.quantity ?? 0), 0) : 0;
        const itemTotal = Array.isArray(order.items) ? order.items.reduce((sum: number, i: any) => sum + Number(i?.subtotal ?? (Number(i?.price ?? 0) * Number(i?.quantity ?? 0))), 0) : 0;
        const total = Number(order?.total ?? 0) || itemTotal || Number(order?.subtotal ?? 0) || 0;
        const priceText = `৳${total.toLocaleString("en-BD")}`;
        const productText = item ? `${item.product_name}${itemCount > 1 ? ` × ${itemCount}` : ""}` : "নতুন অর্ডার";
        const title = `নতুন অর্ডার: ${order?.customer_name ?? ""}`;
        const body = `${productText} • ${order?.customer_phone ?? ""} • ${priceText}`;

        toast.custom(
          (id) => (
            <div className="new-order-popup group w-[min(450px,calc(100vw-20px))] overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-0 shadow-[0_22px_60px_rgba(15,23,42,0.24)] ring-1 ring-emerald-500/10 backdrop-blur-2xl">
              <div className="relative flex min-h-[62px] items-center gap-2.5 px-3 py-2.5">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-50 via-white to-white opacity-90" />
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-lg shadow-emerald-500/25 animate-[newOrderIcon_700ms_cubic-bezier(.2,.8,.2,1)]">
                  <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2.5} />
                </div>
                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600">New Order</span>
                    <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="truncate text-[11px] font-extrabold text-slate-900">{order?.customer_name || "New customer"}</span>
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <span className="truncate text-[10px] font-semibold text-slate-500">{productText}</span>
                    <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800">{priceText}</span>
                  </div>
                </div>
                <button type="button" onClick={() => { toast.dismiss(id); navigate({ to: "/admin/orders" }); }} className="relative shrink-0 rounded-xl bg-slate-900 px-2.5 py-1.5 text-[10px] font-extrabold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-95">View</button>
                <button type="button" aria-label="Close notification" onClick={() => toast.dismiss(id)} className="relative shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="h-0.5 w-full overflow-hidden bg-emerald-100"><div className="h-full origin-left animate-[newOrderProgress_3000ms_linear_forwards] bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-700" /></div>
              <style>{`@keyframes newOrderPopupIn{0%{opacity:0;transform:translate3d(30px,-14px,0) scale(.94)}60%{opacity:1;transform:translate3d(-4px,2px,0) scale(1.01)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}@keyframes newOrderIcon{0%{opacity:0;transform:scale(.55) rotate(-10deg)}70%{transform:scale(1.08) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}@keyframes newOrderProgress{from{transform:scaleX(1)}to{transform:scaleX(0)}}.new-order-popup{animation:newOrderPopupIn 520ms cubic-bezier(.16,1,.3,1) both}`}</style>
            </div>
          ),
          { duration: 3000 }
        );

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            const n = new Notification(title, { body, tag: row?.id });
            n.onclick = () => { window.focus(); navigate({ to: "/admin/orders" }); };
          } catch {}
        }
      };
    const channel = supabase
      .channel("new-order-notifier")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload: any) => {
        const row = payload?.new;
        if (!row?.id || seen.has(row.id)) return;
        seen.add(row.id);
        show(row);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [navigate]);

  return null;
}
