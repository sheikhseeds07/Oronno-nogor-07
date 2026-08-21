import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowRightLeft, Check, Loader2, ShoppingBag, X } from "lucide-react";

const ORDER_ACTION_STATUSES = [
  { value: "web_pending", label: "Processing" },
  { value: "incomplete", label: "Incomplete" },
  { value: "pending", label: "Pending" },
  { value: "rts", label: "RTS (Ready to Ship)" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "pending_return", label: "Return Pending" },
  { value: "returned", label: "Returned" },
  { value: "partial", label: "Partial" },
  { value: "cancelled", label: "Cancelled" },
  { value: "hold", label: "Hold" },
] as const;

function OrderStatusAction() {
  const location = useLocation();
  const selected = ((location.search as Record<string, unknown> | undefined)?.selected as string | undefined) ?? "";
  const isOrdersPage = location.pathname === "/admin/orders";
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOrdersPage || !selected) {
      setOpen(false);
      setStatus("");
      setDraft("");
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status")
        .eq("id", selected)
        .maybeSingle();
      if (cancelled || error) return;
      const next = String(data?.status ?? "");
      setStatus(next);
      setDraft(next);
    };
    void load();
    return () => { cancelled = true; };
  }, [isOrdersPage, selected]);

  if (!isOrdersPage || !selected) return null;

  const currentLabel = (ORDER_ACTION_STATUSES.find((s) => s.value === status)?.label ?? status) || "Status";

  const apply = async () => {
    if (!draft || draft === status || !selected) return;
    setSaving(true);
    const { error } = await supabase.from("orders").update({ status: draft }).eq("id", selected);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStatus(draft);
    setDraft(draft);
    setOpen(false);
    toast.success("Order status updated");
  };

  return (
    <div
      className="fixed z-[100]"
      style={{ top: "calc(15vh + 2px)", right: "max(18px, calc((100vw - 940px) / 2 + 28px))" }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-700 shadow-md backdrop-blur-sm hover:border-brand/40 hover:text-brand-dark"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          <span>Order Action</span>
          <span className="max-w-[92px] truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{currentLabel}</span>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-[230px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="mb-2 text-[11px] font-extrabold text-slate-800">Change Order Status</div>
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            >
              {ORDER_ACTION_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={saving || !draft || draft === status}
              onClick={() => void apply()}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-brand-dark px-3 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {saving ? "Updating..." : "Update Status"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function NewOrderNotifier() {
  const navigate = useNavigate();
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row: any = payload.new;
          if (row?.created_at && new Date(row.created_at).getTime() < startedAt.current - 5000) return;

          const title = `নতুন অর্ডার: ${row?.customer_name ?? ""}`;
          const body = `${row?.customer_phone ?? ""} • ৳${row?.total ?? 0}`;

          toast.custom(
            (id) => (
              <div className="w-[min(430px,calc(100vw-20px))] rounded-xl border border-slate-200/80 bg-white/95 px-2.5 py-2 shadow-[0_12px_35px_rgba(15,23,42,0.18)] ring-1 ring-black/5 backdrop-blur-xl">
                <div className="flex h-9 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
                    <ShoppingBag className="h-4 w-4" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-emerald-600">New Order</span>
                    <span className="h-3 w-px shrink-0 bg-slate-200" />
                    <span className="min-w-0 truncate text-[12px] font-extrabold text-slate-900">{row?.customer_name || "New customer"}</span>
                    <span className="hidden sm:inline shrink-0 text-[10px] text-slate-400">{row?.customer_phone || ""}</span>
                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-800">৳{row?.total ?? 0}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { toast.dismiss(id); navigate({ to: "/admin/orders" }); }}
                    className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] font-extrabold text-white transition hover:bg-slate-800 active:scale-95"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    aria-label="Close notification"
                    onClick={() => toast.dismiss(id)}
                    className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ),
            { duration: 8000 }
          );

          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const n = new Notification(title, { body, tag: row?.id });
              n.onclick = () => { window.focus(); navigate({ to: "/admin/orders" }); };
            } catch {}
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [navigate]);

  return (
    <>
      <OrderStatusAction />
    </>
  );
}
