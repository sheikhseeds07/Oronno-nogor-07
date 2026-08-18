import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode, type MouseEvent } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { supabase } from "@/lib/personal-supabase/client";
import { taka } from "@/lib/format";
import logoUrl from "@/assets/logo.jpg";
import { format } from "date-fns";
import { toast } from "sonner";
import { Search, Plus, Globe, ListOrdered, Trash2, CheckCircle2, Phone, MessageCircle, ExternalLink, Send, Printer, Copy, X, Loader2, AlertCircle, ShoppingCart, Check, ArrowRightLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useServerFn } from "@tanstack/react-start";
import { fetchCourierHistory } from "@/lib/courier-history.functions";
import { sendOrdersToSteadfast, syncSteadfastStatuses } from "@/lib/courier-test.functions";
import { createManualOrder, updateAdminOrder, markOrdersPrinted, deleteOrders } from "@/lib/admin-order.functions";
import { ensureOrderInvoices, reserveInvoiceNos } from "@/lib/order-invoice.functions";
import { getOrderStatusCounts } from "@/lib/reports.functions";
import { acquireOrderLock, heartbeatOrderLock, releaseOrderLock, listOrderLocks } from "@/lib/order-lock.functions";
import { useAuth } from "@/lib/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";



const ordersSearchSchema = z.object({
  tab: z.enum(["search", "new", "web", "list"]).optional(),
  selected: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute("/admin/orders")({
  component: Orders,
  validateSearch: (s) => ordersSearchSchema.parse(s),
});

type OrderStatus =
  | "web_pending" | "incomplete" | "pending" | "rts" | "shipped"
  | "delivered" | "pending_return" | "returned"
  | "partial" | "cancelled" | "hold";

type Tab = "search" | "new" | "web" | "list";

const statusEn: Record<OrderStatus, string> = {
  web_pending: "Processing",
  incomplete: "Incomplete",
  pending: "Pending",
  rts: "RTS (Ready to Ship)",
  shipped: "Shipped",
  delivered: "Delivered",
  pending_return: "Return Pending",
  returned: "Returned",
  partial: "Partial",
  cancelled: "Cancelled",
  hold: "Hold",
};

const statusColor: Record<OrderStatus, string> = {
  web_pending: "bg-blue-100 text-blue-700",
  incomplete: "bg-slate-100 text-slate-700",
  pending: "bg-amber-100 text-amber-700",
  rts: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  pending_return: "bg-orange-100 text-orange-700",
  returned: "bg-rose-100 text-rose-700",
  partial: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
  hold: "bg-gray-200 text-gray-700",
};

// Web order pipeline statuses (before confirmation moves it to "list")
const WEB_STATUSES: OrderStatus[] = ["web_pending", "incomplete", "hold", "cancelled"];

// Format BD phone for WhatsApp (wa.me requires country code without +)
function waNumber(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return "88" + digits;
  return "88" + digits;
}
// Confirmed order list statuses
const ORDER_LIST_PAGE_SIZE_KEY = "order-list-page-size";
const ORDER_LIST_PAGE_SIZES = [20, 50, 70, 100, 200, 500] as const;
type OrderListPageSize = (typeof ORDER_LIST_PAGE_SIZES)[number];

const LIST_STATUSES: OrderStatus[] = [
  "pending", "rts", "shipped", "delivered",
  "pending_return", "returned", "partial", "cancelled",
];

const TABS: { key: Tab; label: string; icon: typeof Search }[] = [
  { key: "search", label: "Search", icon: Search },
  { key: "new", label: "New Order", icon: Plus },
  { key: "web", label: "Web Order", icon: Globe },
  { key: "list", label: "Order List", icon: ListOrdered },
];

// Keys that must refresh whenever any order data changes anywhere.
const ORDER_QUERY_KEYS = [
  "admin-orders",
  "admin-orders-incomplete",
  "order-status-counts",
  "incomplete-count",
  "order-search",
  "order-detail",
] as const;

/** Live-refresh every order related query on any DB change (no page refresh needed). */
function useLiveOrders() {
  const qc = useQueryClient();
  useEffect(() => {
    let scheduled = false;
    const invalidate = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        for (const key of ORDER_QUERY_KEYS) {
          qc.invalidateQueries({ queryKey: [key], refetchType: "all" });
        }
      }, 120);
    };
    const channel = supabase
      .channel("admin-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "incomplete_orders" }, invalidate)
      .subscribe();

    // Safety net if realtime is unavailable: light periodic refresh only.
    // Switching browser tabs must NOT reload or invalidate queries — that's handled by realtime or explicit actions.
    const poll = setInterval(() => { 
      // Only refresh if explicitly needed and not in background to avoid visual reloads on tab switch
      // invalidate(); 
    }, 120_000); // Increased interval to 2 minutes
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [qc]);

}

function Orders() {
  useLiveOrders();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/orders" });
  const tab: Tab = search.tab ?? "web";
  const selected = search.selected ?? null;
  const setTab = (t: Tab) => navigate({ search: (p: typeof search) => ({ ...p, tab: t }) });
  const setSelected = (id: string | null) =>
    navigate({ search: (p: typeof search) => ({ ...p, selected: id ?? undefined }) });
  const qc = useQueryClient();

  return (
    <AdminLayout
      headerExtra={
        <div className="w-full flex gap-1.5 p-1 rounded-xl bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-200 shadow-inner">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-md"
                    : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      }
    >
      {tab === "search" && <SearchPanel onOpen={setSelected} />}
      {tab === "new" && <NewOrderPanel onCreated={() => { setTab("list"); qc.invalidateQueries({ queryKey: ["admin-orders"] }); }} />}
      {tab === "web" && <OrdersTable statuses={WEB_STATUSES} mode="web" onOpen={setSelected} />}
      {tab === "list" && <OrdersTable statuses={LIST_STATUSES} mode="list" onOpen={setSelected} />}

      {selected && (
        <DetailModal
          id={selected}
          onClose={() => setSelected(null)}
          onConfirmed={() => { setSelected(null); qc.invalidateQueries({ queryKey: ["admin-orders"] }); }}
        />
      )}
    </AdminLayout>
  );
}

/* ───────────────── Search Panel (Super Edit) ─────────────────
 *  Search by phone / invoice / name across ALL orders. For each match,
 *  show its section (Web Order vs Order List) and current status with a
 *  one-click status changer.
 */
function SearchPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  // Pending status changes per order (not applied until confirm clicked)
  const [pending, setPending] = useState<Record<string, OrderStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["order-search", submitted],
    enabled: !!submitted,
    queryFn: async () => {
      const term = submitted.trim();
      const orQuery = `customer_phone.ilike.%${term}%,invoice_no.ilike.%${term}%,customer_name.ilike.%${term}%`;
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(id,product_name,quantity,price,product_id)")
        .or(orQuery)
        .order("created_at", { ascending: false });
      return await attachProductImages((data ?? []) as unknown as OrderRow[]);
    },
  });

  const ensureInvoices = useServerFn(ensureOrderInvoices);

  const confirmChange = async (id: string, current: OrderStatus) => {
    const next = pending[id];
    if (!next || next === current) return;
    if (next === "incomplete") { toast.error("ইনকমপ্লিট স্ট্যাটাসে ম্যানুয়ালি যাওয়া যাবে না"); return; }
    setSavingId(id);
    if (next !== "web_pending") {
      try { await ensureInvoices({ data: { ids: [id] } }); } catch { /* invoice পরে সেট হবে */ }
    }
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("স্ট্যাটাস আপডেট হয়েছে");
    setPending((p) => { const c = { ...p }; delete c[id]; return c; });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["order-status-counts"] });
    refetch();
  };

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); setSubmitted(q); setPending({}); }}
        className="flex gap-2 mb-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ফোন নাম্বার / ইনভয়েস / নাম দিন"
            className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        </div>
        <button className="bg-gradient-to-br from-brand to-brand-dark text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition">খুঁজুন</button>
      </form>
      {submitted && isFetching && <div className="py-4"><BrandLoader /></div>}
      {submitted && !isFetching && (data?.length ?? 0) === 0 && (
        <div className="bg-white border rounded-xl p-8 text-center text-sm text-muted-foreground">
          "{submitted}" — কোনো অর্ডার পাওয়া যায়নি
        </div>
      )}
      {submitted && !isFetching && (data?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500 font-semibold px-1">
            {data!.length} টি অর্ডার পাওয়া গেছে — নতুন স্ট্যাটাস সিলেক্ট করে "কনফার্ম" চাপুন
          </div>
          {data!.map((o) => {
            const inv = (o.invoice_no ?? o.id.slice(0, 8)).toUpperCase();
            const section = WEB_STATUSES.includes(o.status) ? "Web Order" : "Order List";
            const pendingStatus = pending[o.id];
            const hasChange = pendingStatus && pendingStatus !== o.status;
            return (
              <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 flex-wrap shadow-sm hover:shadow-md transition">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-700">#{inv}</span>
                    <span className="text-sm font-semibold">{o.customer_name}</span>
                    <span className="text-xs text-slate-500">· {o.customer_phone}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{format(new Date(o.created_at), "dd MMM yyyy, hh:mm a")} · {taka(Number(o.total))}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">{section}</span>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusColor[o.status]}`}>{statusEn[o.status]}</span>
                </div>
                <select
                  value={pendingStatus ?? o.status}
                  onChange={(e) => setPending((p) => ({ ...p, [o.id]: e.target.value as OrderStatus }))}
                  className={`px-2.5 py-1.5 rounded-lg border bg-white text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30 ${hasChange ? "border-amber-400 ring-2 ring-amber-200" : "border-slate-200 hover:border-brand"}`}
                  title="স্ট্যাটাস পরিবর্তন করুন"
                >
                  <optgroup label="Web Order">
                    {WEB_STATUSES.map((s) => <option key={s} value={s}>{statusEn[s]}</option>)}
                  </optgroup>
                  <optgroup label="Order List">
                    {LIST_STATUSES.map((s) => <option key={s} value={s}>{statusEn[s]}</option>)}
                  </optgroup>
                </select>
                <button
                  disabled={!hasChange || savingId === o.id}
                  onClick={() => confirmChange(o.id, o.status)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition ${hasChange ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:shadow-md" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                  title="পরিবর্তন কনফার্ম করুন"
                >
                  {savingId === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  কনফার্ম
                </button>
                <Link
                  to="/admin/orders"
                  search={{ tab: "search", selected: o.id }}
                  onClick={(e) => { if (!e.metaKey && !e.ctrlKey && e.button === 0) { e.preventDefault(); onOpen(o.id); } }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white text-xs font-bold shadow-sm hover:shadow-md transition"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────── Incomplete Orders Panel ─────────────────
 *  Shows checkout-abandoned carts (saved via upsertIncompleteOrder during
 *  the checkout phone-entry step). Admin can call/WhatsApp the customer,
 *  convert to a real order, or delete.
 */
type IncompleteRow = {
  id: string;
  phone: string;
  customer_name: string | null;
  customer_address: string | null;
  delivery_zone: string | null;
  delivery_fee: number;
  subtotal: number;
  total: number;
  note: string | null;
  items: { id: string; name: string; price: number; quantity: number }[];
  created_at: string;
  updated_at: string;
};

function IncompleteOrdersPanel() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const runCreateManualOrder = useServerFn(createManualOrder);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["incomplete-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomplete_orders")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as IncompleteRow[];
    },
    refetchInterval: 30_000,
  });

  const handleDelete = async (id: string, phone: string) => {
    if (!confirm("এই ইনকমপ্লিট অর্ডারটি ডিলিট করবেন?")) return;
    setBusyId(id);
    const { error } = await supabase.from("incomplete_orders").delete().eq("id", id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    await supabase.from("incomplete_events").insert({ phone, event: "cancelled" });
    toast.success("ডিলিট হয়েছে");
    refetch();
  };

  const handleConvert = async (row: IncompleteRow) => {
    if (!row.customer_name || !row.customer_address) {
      toast.error("নাম ও ঠিকানা ছাড়া অর্ডার কনভার্ট করা যাবে না");
      return;
    }
    if (!row.items || row.items.length === 0) {
      toast.error("কোনো প্রডাক্ট নাই");
      return;
    }
    setBusyId(row.id);
    try {
      await runCreateManualOrder({
        data: {
          customer_name: row.customer_name,
          customer_phone: row.phone,
          customer_address: row.customer_address,
          thana: null,
          district: row.delivery_zone ?? null,
          notes: row.note ?? null,
          subtotal: Number(row.subtotal),
          delivery_fee: Number(row.delivery_fee),
          discount: 0,
          total: Number(row.total),
          items: row.items.map((it) => ({
            product_id: null,
            product_name: it.name,
            price: Number(it.price),
            quantity: Number(it.quantity),
          })),
        },
      });
      await supabase.from("incomplete_orders").delete().eq("id", row.id);
      await supabase.from("incomplete_events").insert({ phone: row.phone, event: "converted" });
      toast.success("অর্ডার তৈরি হয়েছে — Pending এ যোগ হয়েছে");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["order-status-counts"] });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "কনভার্ট ব্যর্থ");
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) return <div className="py-8"><BrandLoader /></div>;

  const list = data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-sm font-bold text-slate-700">
          ইনকমপ্লিট অর্ডার <span className="text-slate-400 font-normal">({list.length})</span>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs font-semibold text-brand hover:text-brand-dark"
        >রিফ্রেশ</button>
      </div>

      {list.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center">
          <ShoppingCart className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <div className="text-sm text-muted-foreground">কোনো ইনকমপ্লিট অর্ডার নেই</div>
          <div className="text-xs text-slate-400 mt-1">কাস্টমার চেকআউটে ফোন দিয়ে অর্ডার শেষ না করলে এখানে দেখাবে</div>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((row) => {
            const wa = waNumber(row.phone);
            const itemCount = row.items?.reduce((s, i) => s + Number(i.quantity || 0), 0) ?? 0;
            const canConvert = !!row.customer_name && !!row.customer_address && (row.items?.length ?? 0) > 0;
            return (
              <div key={row.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800">{row.customer_name || <span className="text-slate-400 italic">নাম দেয়নি</span>}</span>
                      <span className="text-xs text-slate-500 font-mono">{row.phone}</span>
                    </div>
                    {row.customer_address && (
                      <div className="text-xs text-slate-600 mt-1">📍 {row.customer_address}</div>
                    )}
                    <div className="text-[11px] text-slate-400 mt-1">
                      {format(new Date(row.updated_at), "dd MMM yyyy, hh:mm a")}
                      {row.delivery_zone && ` · ${row.delivery_zone}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <a
                      href={`tel:${row.phone}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 hover:bg-blue-100"
                    ><Phone className="w-3 h-3" /> কল</a>
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}?text=${encodeURIComponent("আসসালামু আলাইকুম, আপনার অর্ডারটি সম্পূর্ণ হয়নি। আমরা কি সাহায্য করতে পারি?")}`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-200 hover:bg-green-100"
                      ><MessageCircle className="w-3 h-3" /> WA</a>
                    )}
                    <button
                      disabled={!canConvert || busyId === row.id}
                      onClick={() => handleConvert(row)}
                      title={canConvert ? "এই কার্ট থেকে অর্ডার তৈরি করুন" : "নাম ও ঠিকানা ছাড়া কনভার্ট করা যাবে না"}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${canConvert ? "bg-gradient-to-br from-brand to-brand-dark text-white border-brand hover:shadow-md" : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"}`}
                    >
                      {busyId === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      কনভার্ট
                    </button>
                    <button
                      disabled={busyId === row.id}
                      onClick={() => handleDelete(row.id, row.phone)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold border border-red-200 hover:bg-red-100"
                    ><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>

                {row.items?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <ShoppingCart className="w-3 h-3" />
                      <span className="font-semibold">{itemCount}</span> টি প্রডাক্ট
                    </div>
                    <div className="flex-1 text-xs text-slate-600 truncate">
                      {row.items.map((i) => `${i.name}×${i.quantity}`).join(", ")}
                    </div>
                    <div className="text-sm font-bold text-brand-dark whitespace-nowrap">{taka(Number(row.total))}</div>
                  </div>
                )}
                {row.note && (
                  <div className="mt-1 text-[11px] text-slate-500 italic">📝 {row.note}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────── Orders Table ───────────────── */
type SendProgress = { id: string; invoice: string; tracking: string; status: "pending" | "ok" | "fail"; message?: string };

function OrdersTable({
  statuses, mode, onOpen,
}: { statuses: OrderStatus[]; mode: "web" | "list"; onOpen: (id: string) => void }) {
  const defaultFilter: OrderStatus | "all" = mode === "list" ? "pending" : "web_pending";
  const urlSearch = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/orders" });
  const allowed = new Set<string>([...(statuses as string[]), "all"]);
  const filter: OrderStatus | "all" =
    urlSearch.status && allowed.has(urlSearch.status)
      ? (urlSearch.status as OrderStatus | "all")
      : defaultFilter;
  const setFilter = (next: OrderStatus | "all") => {
    navigate({
      search: (p: typeof urlSearch) => ({ ...p, status: next === defaultFilter ? undefined : next }),
      replace: true,
    });
  };
  const [search, setSearch] = useState("");
  const [rtsPageSize, setRtsPageSize] = useState<OrderListPageSize>(() => {
  if (typeof window === "undefined") return 50;
  const saved = Number(window.localStorage.getItem(ORDER_LIST_PAGE_SIZE_KEY));
  return ORDER_LIST_PAGE_SIZES.includes(saved as OrderListPageSize)
    ? (saved as OrderListPageSize)
    : 50;
});
useEffect(() => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ORDER_LIST_PAGE_SIZE_KEY, String(rtsPageSize));
  }
}, [rtsPageSize]);
  const [rtsPage, setRtsPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendModal, setSendModal] = useState<SendProgress[] | null>(null);
  const [sendDone, setSendDone] = useState(false);
  const [dupModal, setDupModal] = useState<{ loading: boolean; rows: DupRow[] } | null>(null);
  const qc = useQueryClient();
  const sendBulk = useServerFn(sendOrdersToSteadfast);
  const ensureInvoices = useServerFn(ensureOrderInvoices);
  const markPrinted = useServerFn(markOrdersPrinted);
  const deleteOrdersFn = useServerFn(deleteOrders);
  const syncStatuses = useServerFn(syncSteadfastStatuses);
  const fetchCounts = useServerFn(getOrderStatusCounts);

  // Status counts (for badges on filter buttons). Realtime subscription below
  // keeps this fresh — no polling needed.
  const { data: counts } = useQuery({
    queryKey: ["order-status-counts", mode, statuses.join(",")],
    queryFn: () => fetchCounts({ data: { statuses: statuses as string[] } }),
    staleTime: 30_000,
  });

  const isIncomplete = filter === "incomplete";
  const isRtsFilter = mode === "list" && filter === "rts";
  const isPendingFilter = mode === "list" && filter === "pending";
  const isShippedFilter = mode === "list" && filter === "shipped";

  // Live count of incomplete checkout carts (separate table). Realtime keeps it fresh.
  const { data: incompleteCount } = useQuery({
    queryKey: ["incomplete-count"],
    enabled: mode === "web",
    queryFn: async () => {
      const { count } = await supabase
        .from("incomplete_orders")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
    staleTime: 30_000,
  });


  // Clear selection whenever the active status filter changes — selection should
  // only persist within a single status view.
  useEffect(() => { setSelectedIds(new Set()); }, [filter, mode]);

  // Auto-sync courier statuses periodically
  useEffect(() => {
    if (!isShippedFilter) return;
    let alive = true;
    const run = async () => {
      // Avoid syncing if tab is not active to prevent unexpected reloads when returning
      if (document.hidden) return;
      try { await syncStatuses({}); if (alive) qc.invalidateQueries({ queryKey: ["admin-orders"] }); } catch { /* skip */ }
    };
    run();
    const t = setInterval(run, 180_000); // Increased to 3 minutes
    return () => { alive = false; clearInterval(t); };
  }, [isShippedFilter, syncStatuses, qc]);

  // Realtime live-updates are handled once in <Orders /> via useLiveOrders().



  const { data: orders, isFetching } = useQuery({
    queryKey: ["admin-orders", mode, filter],
    enabled: !isIncomplete,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const list = (filter === "all" ? statuses : [filter]).filter((s) => s !== "incomplete");
      const { data: ords } = await supabase
        .from("orders")
        .select("id,invoice_no,status,customer_name,customer_phone,customer_address,thana,district,total,courier_consignment,printed_at,created_at,updated_at,created_by,order_items(id,product_name,quantity,price,product_id)")
        .in("status", list as Exclude<OrderStatus, "incomplete">[])
        .order("created_at", { ascending: false })
        .limit(500);
      return await attachProductImages((ords ?? []) as unknown as OrderRow[]);
    },
  });

  const creatorIds = Array.from(new Set((orders ?? []).map((o) => o.created_by).filter((x): x is string => !!x)));
  const { data: creatorProfiles } = useQuery({
    queryKey: ["order-creators", creatorIds.join(",")],
    enabled: creatorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name").in("id", creatorIds);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const creatorMap = useMemo(() => new Map((creatorProfiles ?? []).map((p) => [p.id, p.full_name || "Unknown user"])), [creatorProfiles]);

  // Incomplete checkout carts shaped as OrderRow so they render in the same table.
  // Realtime subscription below keeps this fresh — no polling.
  const { data: incompleteRows, isFetching: incompleteFetching } = useQuery({
    queryKey: ["admin-orders-incomplete"],
    enabled: isIncomplete,
    staleTime: 15_000,
    placeholderData: keepPreviousData,


    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomplete_orders")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      const mapped: OrderRow[] = (data ?? []).map((r: any) => ({
        id: `inc:${r.id}`,
        invoice_no: null,
        customer_name: r.customer_name || "—",
        customer_phone: r.phone,
        customer_address: r.customer_address,
        thana: null,
        district: r.delivery_zone ?? null,
        created_at: r.updated_at ?? r.created_at,
        updated_at: r.updated_at ?? r.created_at,
        total: Number(r.total ?? 0),
        status: "incomplete",
        courier_consignment: null,
        printed_at: null,
        order_items: (r.items ?? []).map((it: any, idx: number) => ({
          id: `${r.id}-${idx}`,
          product_name: it.name,
          quantity: Number(it.quantity ?? 1),
          price: Number(it.price ?? 0),
          product_id: null,
        })),
      }));
      return mapped;
    },
  });

  // Live locks for visible rows
  const { user: meUser } = useAuth();
  const currentUserId = meUser?.id ?? null;
  const fetchLocks = useServerFn(listOrderLocks);
  const orderIds = (orders ?? []).map((o) => o.id);
  const orderIdsKey = orderIds.join(",");
  const { data: locksData } = useQuery({
    queryKey: ["order-locks", orderIdsKey],
    enabled: orderIds.length > 0,
    queryFn: () => fetchLocks({ data: { order_ids: orderIds } }),
    refetchInterval: 8_000,
  });
  const lockMap = useMemo(() => {
    const m = new Map<string, { user_id: string; user_name: string }>();
    for (const l of locksData?.locks ?? []) m.set(l.order_id, { user_id: l.user_id, user_name: l.user_name ?? "Staff" });
    return m;
  }, [locksData]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    if (status === "incomplete") return;
    if (status !== "web_pending") {
      try { await ensureInvoices({ data: { ids: [id] } }); } catch { /* invoice পরে সেট হবে */ }
    }
    // Optimistic remove from current visible list
    qc.setQueriesData<OrderRow[] | undefined>({ queryKey: ["admin-orders"] }, (old) =>
      old ? old.filter((o) => o.id !== id) : old,
    );
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      return;
    }
    toast.success("আপডেট হয়েছে");
    qc.invalidateQueries({ queryKey: ["order-status-counts"] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };


  const baseRows = isIncomplete ? (incompleteRows ?? []) : (orders ?? []);

  // For incomplete rows we simply open the DetailModal in "draft" mode
  // (no real order created yet). The DetailModal will create the order
  // with status='pending' only when the admin clicks "Create Order".
  const handleOpen = (id: string) => { onOpen(id); };


  const searchTerm = search.trim().toLowerCase();
  const rows = searchTerm
    ? baseRows.filter((o) => {
        const inv = (o.invoice_no ?? o.id).toLowerCase();
        const phone = (o.customer_phone ?? "").toLowerCase();
        const name = (o.customer_name ?? "").toLowerCase();
        const cn = (o.courier_consignment ?? "").toLowerCase();
        return inv.includes(searchTerm) || phone.includes(searchTerm) || name.includes(searchTerm) || cn.includes(searchTerm);
      })
    : baseRows;
  const rtsTotalPages = Math.max(1, Math.ceil(rows.length / rtsPageSize));
  const displayRows = mode === "list" ? rows.slice((rtsPage - 1) * rtsPageSize, rtsPage * rtsPageSize) : rows;
  useEffect(() => { setRtsPage(1); }, [filter, mode, search, rtsPageSize]);
  useEffect(() => { if (rtsPage > rtsTotalPages) setRtsPage(rtsTotalPages); }, [rtsPage, rtsTotalPages]);
  const allChecked = displayRows.length > 0 && displayRows.every((o) => selectedIds.has(o.id));
  const toggleAll = () => {
    setSelectedIds(() => allChecked ? new Set() : new Set(displayRows.map((o) => o.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const bulkSendCourier = async (account: 1 | 2 = 1) => {
    if (!selectedIds.size) return;
    const picked = rows.filter((o) => selectedIds.has(o.id));
    const initial: SendProgress[] = picked.map((o) => ({
      id: o.id,
      invoice: (o.invoice_no ?? o.id.slice(0, 8)).toUpperCase(),
      tracking: o.courier_consignment ?? "",
      status: "pending",
    }));
    setSendModal(initial);
    setSendDone(false);

    // Send one-by-one for animation
    for (const item of initial) {
      try {
        const res = await sendBulk({ data: { orderIds: [item.id], account } });

        const r = res.results?.[0];
        setSendModal((prev) => prev && prev.map((p) =>
          p.id === item.id
            ? r?.ok
              ? { ...p, status: "ok", tracking: r.consignment ?? p.tracking, message: r.message }
              : { ...p, status: "fail", message: r?.message ?? res.error ?? "Failed" }
            : p,
        ));
      } catch (e) {
        setSendModal((prev) => prev && prev.map((p) =>
          p.id === item.id ? { ...p, status: "fail", message: e instanceof Error ? e.message : "ব্যর্থ" } : p,
        ));
      }
    }
    setSendDone(true);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const bulkPrintInvoice = async () => {
    const picked = rows
      .filter((o) => selectedIds.has(o.id))
      .sort((a, b) => {
        const aInvoice = (a.invoice_no ?? a.id).toUpperCase();
        const bInvoice = (b.invoice_no ?? b.id).toUpperCase();
        return aInvoice.localeCompare(bInvoice, undefined, { numeric: true, sensitivity: "base" });
      });
    if (!picked.length) return;
    const html = buildInvoicesHTML(picked);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    try {
      await markPrinted({ data: { ids: picked.map((p) => p.id) } });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch { /* non-fatal */ }
  };

  const bulkDuplicateCheck = async () => {
    const picked = rows.filter((o) => selectedIds.has(o.id));
    if (!picked.length) return toast.error("আগে অর্ডার সিলেক্ট করুন");
    setDupModal({ loading: true, rows: [] });
    const phones = Array.from(new Set(picked.map((p) => (p.customer_phone || "").replace(/\D/g, "").slice(-11)).filter(Boolean)));
    const { data } = await supabase
      .from("orders")
      .select("id,invoice_no,customer_name,customer_phone,total,status,created_at,courier_consignment")
      .in("status", ["pending", "rts", "shipped", "pending_return", "returned", "partial", "hold"])
      .order("created_at", { ascending: false });
    const all = (data ?? []).filter((o) => phones.includes((o.customer_phone || "").replace(/\D/g, "").slice(-11)));
    // group by phone, only keep groups with >1
    const groups = new Map<string, typeof all>();
    for (const o of all) {
      const key = (o.customer_phone || "").replace(/\D/g, "").slice(-11);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(o);
    }
    const dupRows: DupRow[] = [];
    for (const [phone, list] of groups) {
      if (list.length < 2) continue;
      for (const o of list) {
        dupRows.push({
          id: o.id,
          invoice: (o.invoice_no ?? o.id.slice(0, 8)).toUpperCase(),
          phone,
          name: o.customer_name,
          total: Number(o.total),
          status: o.status as OrderStatus,
          consignment: o.courier_consignment,
          created_at: o.created_at,
        });
      }
    }
    setDupModal({ loading: false, rows: dupRows });
  };

  const handleDeleteDup = async (id: string) => {
    if (!confirmWindow("এই অর্ডার ডিলিট করবেন?")) return;
    try {
      await deleteOrdersFn({ data: { ids: [id] } });
      toast.success("ডিলিট হয়েছে");
      setDupModal((prev) => prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== id) } : prev);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ব্যর্থ");
    }
  };

  const optimisticRemove = (ids: string[]) => {
    // Remove instantly from every cached admin-orders list so UI updates in ns
    qc.setQueriesData<OrderRow[] | undefined>({ queryKey: ["admin-orders"] }, (old) =>
      old ? old.filter((o) => !ids.includes(o.id)) : old,
    );
    setSelectedIds(new Set());
  };

  const bulkMoveTo = async (target: "rts" | "pending" | "shipped", label: string) => {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    optimisticRemove(ids);
    try { await ensureInvoices({ data: { ids } }); } catch { /* invoice পরে সেট হবে */ }
    const { error } = await supabase.from("orders").update({ status: target }).in("id", ids);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      return;
    }
    toast.success(`${ids.length} টি অর্ডার ${label} এ পাঠানো হয়েছে`);
    qc.invalidateQueries({ queryKey: ["order-status-counts"] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const bulkMoveToRts = () => bulkMoveTo("rts", "RTS");
  const bulkMoveToPending = () => bulkMoveTo("pending", "Pending");
  const bulkMoveToShipped = () => {
    if (!selectedIds.size) return;
    const picked = rows.filter((o) => selectedIds.has(o.id));
    const missing = picked.filter((o) => !o.courier_consignment);
    if (missing.length) {
      toast.error(`${missing.length} টি অর্ডার এখনো কুরিয়ারে পাঠানো হয়নি — Shipped এ মুভ করা যাবে না`);
      return;
    }
    bulkMoveTo("shipped", "Shipped");
  };

  const handleSyncNow = async () => {
    toast.info("কুরিয়ার স্ট্যাটাস সিঙ্ক হচ্ছে...");
    const r = await syncStatuses({});
    if (r.error) toast.error(r.error);
    else toast.success(`${r.updated} টি অর্ডার আপডেট হয়েছে`);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const bulkUpdateStatus = async (status: Exclude<OrderStatus, "incomplete">) => {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    optimisticRemove(ids);
    if (status !== "web_pending") {
      try { await ensureInvoices({ data: { ids } }); } catch { /* invoice পরে সেট হবে */ }
    }
    const { error } = await supabase.from("orders").update({ status }).in("id", ids);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      return;
    }
    toast.success(`${ids.length} টি অর্ডার "${statusEn[status]}" এ পাঠানো হয়েছে`);
    qc.invalidateQueries({ queryKey: ["order-status-counts"] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const bulkDeleteSelected = async () => {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    if (!confirmWindow(`${ids.length} টি অর্ডার ডিলিট করবেন? এই কাজ আর ফিরিয়ে আনা যাবে না।`)) return;
    
    // Optimistic remove
    optimisticRemove(ids);

    try {
      const res = await deleteOrdersFn({ data: { ids } });
      toast.success(`${res.deleted} টি অর্ডার ডিলিট হয়েছে`);
      qc.invalidateQueries({ queryKey: ["order-status-counts"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ব্যর্থ");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  };




  // Bulk actions for incomplete rows (ids prefixed with "inc:").
  const bulkIncompletePromote = async () => {
    const ids = Array.from(selectedIds).filter((x) => x.startsWith("inc:")).map((x) => x.slice(4));
    const picked = (incompleteRows ?? []).filter((r) => ids.includes(r.id.slice(4)));
    if (!picked.length) return;
    try {
      const inserts = picked.map((row) => {
        const its = row.order_items ?? [];
        const subtotal = its.reduce((a, i) => a + Number(i.price) * Number(i.quantity), 0);
        const deliveryFee = Math.max(0, Number(row.total) - subtotal);
        return {
          row,
          insert: {
            customer_name: row.customer_name || row.customer_phone,
            customer_phone: row.customer_phone,
            customer_address: row.customer_address ?? null,
            thana: null,
            district: row.district ?? null,
            notes: null,
            subtotal,
            delivery_fee: deliveryFee,
            discount: 0,
            total: Number(row.total),
            source: "web" as const,
            status: "web_pending" as const,
            payment_method: "cod",
            originated_from_incomplete: true,
          },
        };
      });
      const { data: created, error } = await supabase
        .from("orders")
        .insert(inserts.map((x) => x.insert))
        .select("id");
      if (error || !created) throw new Error(error?.message ?? "অর্ডার তৈরি ব্যর্থ");
      const itemRows: any[] = [];
      created.forEach((ord, idx) => {
        const its = inserts[idx].row.order_items ?? [];
        its.forEach((i) => {
          itemRows.push({
            order_id: ord.id,
            product_id: null,
            product_name: i.product_name,
            quantity: i.quantity,
            price: Number(i.price),
            subtotal: Number(i.price) * i.quantity,
          });
        });
      });
      if (itemRows.length) await supabase.from("order_items").insert(itemRows);
      await supabase.from("incomplete_orders").delete().in("id", ids);
      await supabase.from("incomplete_events").insert(picked.map((p) => ({ phone: p.customer_phone, event: "converted" })));
      toast.success(`${picked.length} টি পেন্ডিং এ পাঠানো হয়েছে`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["admin-orders-incomplete"] });
      qc.invalidateQueries({ queryKey: ["incomplete-count"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["order-status-counts"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); }
  };

  const bulkIncompleteCancel = async () => {
    const ids = Array.from(selectedIds).filter((x) => x.startsWith("inc:")).map((x) => x.slice(4));
    if (!ids.length) return;
    if (!confirmWindow(`${ids.length} টি ইনকমপ্লিট অর্ডার ক্যান্সেল করবেন?`)) return;
    try {
      const picked = (incompleteRows ?? []).filter((r) => ids.includes(r.id.slice(4)));
      const { error } = await supabase.from("incomplete_orders").delete().in("id", ids);
      if (error) throw new Error(error.message);
      if (picked.length) {
        await supabase.from("incomplete_events").insert(picked.map((p) => ({ phone: p.customer_phone, event: "cancelled" })));
      }
      toast.success(`${ids.length} টি ক্যান্সেল হয়েছে`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["admin-orders-incomplete"] });
      qc.invalidateQueries({ queryKey: ["incomplete-count"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "ব্যর্থ"); }
  };


  return (
    <div>
      {/* Search bar — works across the current status view */}
      <div className="mb-3 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`এই স্ট্যাটাসে সার্চ করুন — ফোন / ইনভয়েস / নাম / কনসাইনমেন্ট`}
          className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-slate-500"
            title="ক্লিয়ার"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {statuses.map((s) => {
          const c = s === "incomplete" ? (incompleteCount ?? 0) : (counts?.[s] ?? 0);
          const active = filter === s;
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap font-bold inline-flex items-center gap-1.5 transition-all duration-200 ${
                active
                  ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-md scale-105"
                  : "bg-white border border-slate-200 text-slate-700 hover:border-brand/40 hover:shadow-sm"
              }`}
            >
              {statusEn[s]}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/25" : c > 0 ? "bg-brand/10 text-brand-dark" : "bg-slate-100 text-slate-500"}`}>
                {c}
              </span>
            </button>
          );
        })}
        {isShippedFilter && (
          <button
            onClick={handleSyncNow}
            className="ml-auto px-3 py-1.5 rounded-full text-xs whitespace-nowrap font-bold bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md hover:shadow-lg inline-flex items-center gap-1.5 transition"
            title="কুরিয়ার থেকে স্ট্যাটাস সিঙ্ক করুন"
          >
            <Loader2 className="w-3 h-3" /> স্ট্যাটাস সিঙ্ক
          </button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-3 py-2.5 text-sm flex-wrap shadow-sm">
          <span className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-gradient-to-br from-brand to-brand-dark text-white text-xs font-bold shadow-sm">
            <span className="w-5 h-5 inline-flex items-center justify-center rounded-full bg-white/25 text-[11px]">{selectedIds.size}</span>
            সিলেক্টেড
          </span>
          {mode === "list" && !isPendingFilter && (
            <ActionBtn onClick={bulkMoveToPending} icon={CheckCircle2} tone="amber">Pending এ পাঠান</ActionBtn>
          )}
          {mode === "list" && !isRtsFilter && (
            <ActionBtn onClick={bulkMoveToRts} icon={CheckCircle2} tone="indigo">RTS এ পাঠান</ActionBtn>
          )}
          {(filter === "pending" || filter === "rts" || filter === "cancelled") && (
            <ActionBtn onClick={bulkDeleteSelected} icon={Trash2} tone="rose">ডিলিট করুন</ActionBtn>
          )}

          
          {isRtsFilter && (
            <>
              <ActionBtn onClick={() => bulkSendCourier(1)} icon={Send} tone="emerald">কুরিয়ার ১ এ পাঠান (Steadfast)</ActionBtn>
              <ActionBtn onClick={() => bulkSendCourier(2)} icon={Send} tone="emerald">কুরিয়ার ২ এ পাঠান (Steadfast)</ActionBtn>

              <ActionBtn onClick={bulkPrintInvoice} icon={Printer} tone="blue">ইনভয়েস প্রিন্ট</ActionBtn>
              <ActionBtn onClick={bulkDuplicateCheck} icon={Copy} tone="purple">ডুবলিকেট চেক</ActionBtn>
              <ActionBtn onClick={bulkMoveToShipped} icon={CheckCircle2} tone="violet" title="কুরিয়ারে পাঠানোর পর Shipped এ মুভ করুন">Shipped এ মুভ</ActionBtn>
            </>
          )}
          {mode === "web" && !isIncomplete && (
            <>
              <ActionBtn onClick={() => bulkUpdateStatus("pending")} icon={CheckCircle2} tone="emerald" title="অর্ডার লিস্টে পাঠান (Pending)">অর্ডার লিস্টে পাঠান</ActionBtn>
              <select
                onChange={(e) => { const v = e.target.value; if (v && v !== "incomplete") { const ok = window.confirm(`স্ট্যাটাস "${statusEn[v as OrderStatus]}" এ পরিবর্তন করবেন?`); if (ok) bulkUpdateStatus(v as Exclude<OrderStatus, "incomplete">); e.target.value = ""; } }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand/30"
                defaultValue=""
              >
                <option value="" disabled>স্ট্যাটাস চেন্জ...</option>
                <option value="hold">হোল্ড</option>
                <option value="cancelled">ক্যান্সেলড</option>
                <option value="web_pending">ওয়েব পেন্ডিং</option>
              </select>
              
            </>
          )}
          {isIncomplete && (
            <>
              <ActionBtn onClick={bulkIncompletePromote} icon={CheckCircle2} tone="emerald">ওয়েব পেন্ডিং এ পাঠান</ActionBtn>
              <ActionBtn onClick={bulkIncompleteCancel} icon={Trash2} tone="rose">ক্যান্সেল</ActionBtn>
            </>
          )}

          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-900 font-semibold underline-offset-2 hover:underline">ক্লিয়ার</button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <OrdersTableRows
          orders={displayRows}
          loading={isIncomplete ? incompleteFetching : isFetching}
          mode={mode}
          onOpen={handleOpen}
          selectedIds={selectedIds}
          onToggleOne={toggleOne}
          onToggleAll={toggleAll}

          allChecked={allChecked}
          lockMap={lockMap}
          currentUserId={currentUserId}
          creatorMap={creatorMap}
          empty={isIncomplete ? "কোনো ইনকমপ্লিট অর্ডার নেই — কাস্টমার চেকআউটে ফোন দিয়ে অর্ডার শেষ না করলে এখানে আসবে" : (search ? `"${search}" এর সাথে মিলে এমন কোনো অর্ডার নেই` : "কোনো অর্ডার নেই")}
        />

      </div>

      {mode === "list" && rows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold">প্রতি পেইজে</span>
            <select value={rtsPageSize} onChange={(e) => setRtsPageSize(Number(e.target.value) as OrderListPageSize)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand/30"><option value={20}>20</option><option value={50}>50</option><option value={70}>70</option><option value={100}>100</option><option value={200}>200</option><option value={500}>500</option></select>
            <span>অর্ডার · মোট {rows.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button disabled={rtsPage === 1} onClick={() => setRtsPage((p) => Math.max(1,p-1))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold disabled:opacity-40">Previous</button>
            {Array.from({length:rtsTotalPages},(_,i)=>i+1).map((p) => <button key={p} onClick={() => setRtsPage(p)} className={`min-w-8 rounded-lg px-2 py-1.5 text-xs font-bold ${rtsPage===p ? 'bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{p}</button>)}
            <button disabled={rtsPage === rtsTotalPages} onClick={() => setRtsPage((p) => Math.min(rtsTotalPages,p+1))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {sendModal && (
        <SendProgressModal
          rows={sendModal}
          done={sendDone}
          onClose={() => { setSendModal(null); setSelectedIds(new Set()); }}
        />
      )}

      {dupModal && (
        <DuplicateModal
          loading={dupModal.loading}
          rows={dupModal.rows}
          onDelete={handleDeleteDup}
          onClose={() => setDupModal(null)}
        />
      )}
    </div>
  );
}

function confirmWindow(msg: string) {
  if (typeof window === "undefined") return false;
  return window.confirm(msg);
}

type Tone = "emerald" | "amber" | "indigo" | "blue" | "purple" | "violet" | "rose";
const TONE_CLASSES: Record<Tone, string> = {
  emerald: "bg-gradient-to-br from-emerald-500 to-emerald-700 hover:shadow-emerald-300/40",
  amber:   "bg-gradient-to-br from-amber-500 to-amber-600 hover:shadow-amber-300/40",
  indigo:  "bg-gradient-to-br from-indigo-500 to-indigo-700 hover:shadow-indigo-300/40",
  blue:    "bg-gradient-to-br from-sky-500 to-blue-700 hover:shadow-blue-300/40",
  purple:  "bg-gradient-to-br from-fuchsia-500 to-purple-700 hover:shadow-purple-300/40",
  violet:  "bg-gradient-to-br from-violet-500 to-violet-700 hover:shadow-violet-300/40",
  rose:    "bg-gradient-to-br from-rose-500 to-rose-700 hover:shadow-rose-300/40",
};
function ActionBtn({ onClick, icon: Icon, tone, title, children }: {
  onClick: () => void; icon: typeof Send; tone: Tone; title?: string; children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 ${TONE_CLASSES[tone]}`}
    >
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

type DupRow = {
  id: string; invoice: string; phone: string; name: string;
  total: number; status: OrderStatus; consignment: string | null; created_at: string;
};

/* ───────────── Send Progress Modal ───────────── */
function SendProgressModal({ rows, done, onClose }: { rows: SendProgress[]; done: boolean; onClose: () => void }) {
  const okCount = rows.filter((r) => r.status === "ok").length;
  const failCount = rows.filter((r) => r.status === "fail").length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const processed = okCount + failCount;
  const pct = Math.round((processed / Math.max(rows.length, 1)) * 100);
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Gradient header */}
        <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                {done ? <CheckCircle2 className="w-6 h-6" /> : <Send className="w-5 h-5 animate-pulse" />}
              </div>
              <div>
                <div className="font-bold text-lg leading-tight">{done ? "আপলোড সম্পন্ন" : "Steadfast এ আপলোড হচ্ছে"}</div>
                <div className="text-xs text-white/80 mt-0.5">{processed} / {rows.length} প্রসেসড · {pendingCount} বাকি</div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition"><X className="w-4 h-4" /></button>
          </div>
          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                style={{ width: `${pct}%` }}
              >
                {!done && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shimmer_1.5s_infinite]" />}
              </div>
            </div>
            <span className="text-sm font-bold tabular-nums w-12 text-right">{pct}%</span>
          </div>
          {/* Stats pills */}
          <div className="flex gap-2 mt-3">
            <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {okCount} সফল
            </span>
            {failCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-rose-500/90 text-xs font-semibold inline-flex items-center gap-1">
                <X className="w-3 h-3" /> {failCount} ব্যর্থ
              </span>
            )}
            {pendingCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> {pendingCount} প্রসেসিং
              </span>
            )}
          </div>
        </div>

        {/* Rows */}
        <div className="max-h-[55vh] overflow-y-auto divide-y">
          {rows.map((r, i) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-5 py-3 transition-all duration-300 ${
                r.status === "ok" ? "bg-emerald-50/40" : r.status === "fail" ? "bg-rose-50/40" : ""
              }`}
              style={{ animation: r.status !== "pending" ? `fade-in 0.4s ease-out` : undefined }}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-slate-100 text-slate-500">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{r.invoice}</span>
                  {r.tracking && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold font-mono">
                      CN: {r.tracking}
                    </span>
                  )}
                </div>
                {r.message && r.status === "fail" && (
                  <div className="text-[11px] text-rose-600 truncate mt-0.5" title={r.message}>{r.message}</div>
                )}
              </div>
              <div className="shrink-0">
                {r.status === "pending" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading
                  </span>
                )}
                {r.status === "ok" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold animate-scale-in">
                    <CheckCircle2 className="w-3 h-3" /> Uploaded
                  </span>
                )}
                {r.status === "fail" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold animate-scale-in">
                    <X className="w-3 h-3" /> Failed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            {done ? "✓ আপলোড সম্পন্ন হয়েছে" : "অনুগ্রহ করে অপেক্ষা করুন..."}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50"
            disabled={!done}
          >
            {done ? "Close" : "Processing..."}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Duplicate Modal ───────────── */
function DuplicateModal({ loading, rows, onDelete, onClose }: { loading: boolean; rows: DupRow[]; onDelete: (id: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <div className="font-bold">Check Duplicate Orders</div>
            <div className="text-xs text-muted-foreground">ডেলিভার্ড বাদে সব স্ট্যাটাস (RTS, Shipped, Pending, ইত্যাদি) চেক করা হয়েছে</div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 max-h-[65vh] overflow-y-auto">
          {loading && <p className="text-center py-8 text-sm text-muted-foreground">চেক করা হচ্ছে...</p>}
          {!loading && rows.length === 0 && <p className="text-center py-8 text-sm text-emerald-700 font-semibold">কোনো ডুবলিকেট পাওয়া যায়নি ✓</p>}
          {!loading && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="text-left pb-2">Invoice</th><th className="text-left pb-2">নাম</th><th className="text-left pb-2">ফোন</th><th className="text-left pb-2">স্ট্যাটাস</th><th className="text-right pb-2">অ্যাকশন</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 font-mono text-xs">{r.invoice}</td>
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 font-mono text-xs">{r.phone}</td>
                    <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded font-semibold ${statusColor[r.status]}`}>{statusEn[r.status]}</span></td>
                    <td className="py-2 text-right">
                      <button onClick={() => onDelete(r.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700">
                        <Trash2 className="w-3 h-3" /> ডিলিট
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

type OrderItemRow = {
  id: string; product_name: string; quantity: number;
  price: number; product_id: string | null; image?: string;
};

type OrderRow = {
  id: string; invoice_no: string | null; customer_name: string;
  customer_phone: string; customer_address?: string | null;
  thana?: string | null; district?: string | null;
  created_at: string; updated_at?: string | null; total: number; status: OrderStatus;
  courier_consignment?: string | null; printed_at?: string | null;
  order_items?: OrderItemRow[];
  assigned_to?: string | null;
  created_by?: string | null;
};


/** Show first 3 product thumbnails; collapse the rest into a "+N" pill that
 *  opens a hover/click popover with all remaining items. */
function OrderItemsThumbs({ items }: { items: OrderItemRow[] }) {
  const [open, setOpen] = useState(false);
  if (!items?.length) return <span className="text-xs text-muted-foreground">—</span>;
  const visible = items.slice(0, 3);
  const rest = items.slice(3);
  const Thumb = ({ it, size = "w-12 h-12" }: { it: OrderItemRow; size?: string }) => (
    <div className="relative shrink-0" title={`${it.product_name} × ${it.quantity}`}>
      {it.image ? (
        <img src={it.image} alt="" loading="lazy" className={`${size} object-cover rounded border`} />
      ) : (
        <div className={`${size} rounded border bg-muted`} />
      )}
      {it.quantity > 1 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center border border-white">
          {it.quantity}
        </span>
      )}
    </div>
  );
  return (
    <div className="flex flex-wrap gap-1.5 items-center relative">
      {visible.map((it) => <Thumb key={it.id} it={it} />)}
      {rest.length > 0 && (
        <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-12 h-12 rounded border-2 border-dashed border-brand/40 bg-brand/5 text-brand-dark text-[11px] font-bold inline-flex items-center justify-center hover:bg-brand/10 transition"
            title={`আরও ${rest.length} টি প্রোডাক্ট দেখুন`}
            aria-label="more items"
          >
            +{rest.length}
            <span className="ml-0.5">···</span>
          </button>
          {open && (
            <div className="absolute z-30 left-0 top-full mt-1 p-2 bg-white border border-slate-200 rounded-xl shadow-xl min-w-[220px] max-w-[300px]">
              <div className="text-[11px] font-bold text-slate-500 mb-1.5 px-1">আরও {rest.length} টি প্রোডাক্ট</div>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {rest.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 w-full p-1 rounded hover:bg-slate-50">
                    <Thumb it={it} size="w-10 h-10" />
                    <div className="text-[11px] text-slate-700 line-clamp-2 flex-1">{it.product_name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function attachProductImages(orders: OrderRow[]): Promise<OrderRow[]> {
  const ids = Array.from(new Set(
    orders.flatMap((o) => (o.order_items ?? []).map((it) => it.product_id).filter((x): x is string => !!x))
  ));
  const map: Record<string, string> = {};
  if (ids.length) {
    const { data: prods } = await supabase.from("products").select("id,images").in("id", ids);
    for (const p of prods ?? []) map[p.id] = ((p.images as string[] | null) ?? [])[0] ?? "";
  }
  return orders.map((o) => ({
    ...o,
    order_items: (o.order_items ?? []).map((it) => ({ ...it, image: it.product_id ? map[it.product_id] : "" })),
  }));
}

/* ───────────── Invoice HTML Builder (clean, minimal) ───────────── */
type InvoiceOrder = OrderRow & { courier_consignment?: string | null };
const LOGO_URL = (typeof window !== "undefined" ? window.location.origin : "") + logoUrl;
function buildInvoicesHTML(orders: InvoiceOrder[]) {
  const css = `
    *{box-sizing:border-box}
    @page{size:A4;margin:12mm}
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;color:#0f172a;background:#fff}
    .inv{max-width:800px;margin:0 auto;padding:24px;page-break-after:always}
    .head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:3px solid #0f172a;padding-bottom:14px;margin-bottom:18px;gap:18px}
    .logo{width:90px;height:90px;border-radius:10px;object-fit:cover;background:#f1f5f9;border:1px solid #e2e8f0}
    .invtitle{font-size:42px;font-weight:900;letter-spacing:4px;color:#0f172a;line-height:1;text-align:center;justify-self:center}
    .invtitle .num{color:#8b0000}
    .invspacer{width:90px}
    .meta{display:flex;justify-content:space-between;font-size:13px;margin-bottom:14px;color:#334155}
    .meta b{color:#0f172a}
    .cust{border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:13px;line-height:1.6}
    .cust .name{font-size:17px;font-weight:800;color:#0f172a}
    table.items{width:100%;border-collapse:collapse;margin-top:6px;font-size:14px}
    table.items th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:12px;letter-spacing:1px;text-transform:uppercase}
    table.items td{padding:10px 12px;border-bottom:1px solid #e2e8f0}
    table.items th:last-child,table.items td:last-child{text-align:center;width:120px;font-weight:700}
    .totals{margin-top:18px;display:flex;justify-content:flex-end}
    .sumbox{min-width:280px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    .sumrow{display:flex;justify-content:space-between;padding:8px 14px;font-size:13px}
    .sumrow:nth-child(odd){background:#f8fafc}
    .sumrow.total{background:#0f172a;color:#fff;font-weight:800;font-size:16px}
    .footer{text-align:center;margin-top:24px;font-size:12px;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:10px}
  `;
  const body = orders.map((o) => {
    const inv = (o.invoice_no ?? o.id.slice(0, 8)).toUpperCase();
    const invMatch = inv.match(/^([A-Za-z]+)(.*)$/);
    const invHtml = invMatch ? `${escapeHtml(invMatch[1])}<span class="num">${escapeHtml(invMatch[2])}</span>` : escapeHtml(inv);
    const items = o.order_items ?? [];
    const itemRows = items.map((i) => `<tr><td>${escapeHtml(i.product_name)}</td><td>${i.quantity}</td></tr>`).join("");
    const subtotal = items.length ? items.reduce((a, i) => a + Number(i.price) * i.quantity, 0) : Number(o.total);
    const delivery = Math.max(0, Number(o.total) - subtotal);
    const tracking = o.courier_consignment ?? "";
    return `
      <div class="inv">
        <div class="head">
          <img class="logo" src="${escapeHtml(LOGO_URL)}" alt="logo"/>
          <div class="invtitle">${invHtml}</div>
          <div class="invspacer"></div>
        </div>
        <div class="meta">
          <div><b>তারিখ:</b> ${format(new Date(o.created_at), "dd MMM yyyy")}</div>
          <div><b>কুরিয়ার:</b> Steadfast${tracking ? ` · ${escapeHtml(tracking)}` : ""}</div>
        </div>
        <table class="items">
          <thead><tr><th>প্রোডাক্ট</th><th>কোয়ান্টিটি</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="totals">
          <div class="sumbox">
            <div class="sumrow"><span>সাবটোটাল</span><span>৳ ${subtotal.toFixed(0)}</span></div>
            <div class="sumrow"><span>ডেলিভারি চার্জ</span><span>৳ ${delivery.toFixed(0)}</span></div>
            <div class="sumrow total"><span>মোট</span><span>৳ ${Number(o.total).toFixed(0)}</span></div>
          </div>
        </div>
        <div class="footer">ধন্যবাদ — অরন্য নগর থেকে কেনাকাটার জন্য</div>
      </div>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Invoices</title><style>${css}</style></head>
    <body>${body}<script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script></body></html>`;
}

function escapeHtml(s: string) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function CourierSuccessCell({ phone }: { phone: string }) {
  const fn = useServerFn(fetchCourierHistory);
  const digits = (phone || "").replace(/\D/g, "").slice(-11);
  const enabled = digits.length >= 10;
  const { data, isFetching } = useQuery({
    queryKey: ["courier-rate", digits],
    enabled,
    queryFn: () => fn({ data: { phone: digits } }),
    staleTime: 10 * 60_000,
  });
  if (!enabled) return <span className="text-xs text-muted-foreground">—</span>;
  if (isFetching && !data) return <span className="text-xs text-muted-foreground">লোড...</span>;
  if (!data?.configured) return <span className="text-xs text-muted-foreground">—</span>;
  const total = data.stats.reduce((a, s) => a + s.total, 0);
  const success = data.stats.reduce((a, s) => a + s.success, 0);
  const cancelled = data.stats.reduce((a, s) => a + s.cancelled, 0);
  if (!total) return <span className="text-xs text-muted-foreground">কোনো রেকর্ড নেই</span>;
  const rate = Math.round((success / total) * 100);
  const ring = rate >= 80 ? "border-emerald-500 text-emerald-700" : rate >= 50 ? "border-amber-500 text-amber-700" : "border-rose-500 text-rose-700";
  return (
    <div className="flex items-center gap-2">
      <div className={`w-9 h-9 rounded-full border-[3px] ${ring} flex items-center justify-center text-[10px] font-bold`}>{rate}%</div>
      <div className="text-[11px] leading-tight">
        <div className="text-emerald-700">Success: <b>{rate}%</b></div>
        <div className="text-muted-foreground">Order: <b>{success}/{total}</b></div>
        <div className="text-rose-600">Cancel: <b>{cancelled}</b></div>
      </div>
    </div>
  );
}

function RelativeUpdatedTime({ value }: { value?: string | null }) {
  const [, refresh] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => refresh((v) => v + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  let label = 'এইমাত্র';
  if (seconds >= 86400) label = `${Math.floor(seconds / 86400)} দিন`;
  else if (seconds >= 3600) label = `${Math.floor(seconds / 3600)} ঘণ্টা`;
  else if (seconds >= 60) label = `${Math.floor(seconds / 60)} মিনিট`;
  else if (seconds > 0) label = `${seconds} সেকেন্ড`;

  return (
    <div
      className="text-[10px] text-slate-400 mt-0.5"
      title={`শেষ আপডেট: ${format(new Date(value), "dd MMM yyyy, hh:mm a")}`}
    >
      শেষ আপডেট: {label}{label === 'এইমাত্র' ? '' : ' আগে'}
    </div>
  );
}

function OrdersTableRows({
  orders, loading, mode, onOpen, empty,
  selectedIds, onToggleOne, onToggleAll, allChecked,
  lockMap, currentUserId, creatorMap,
}: {
  orders: OrderRow[]; loading?: boolean; mode?: "web" | "list";
  onOpen: (id: string) => void;
  empty: string;
  selectedIds?: Set<string>;
  onToggleOne?: (id: string) => void;
  onToggleAll?: () => void;
  allChecked?: boolean;
  lockMap?: Map<string, { user_id: string; user_name: string }>;
  currentUserId?: string | null;
  creatorMap?: Map<string, string>;
}) {
  const isWeb = mode === "web";
  const isList = mode === "list";
  const showCheckbox = !!selectedIds && !!onToggleOne && (isWeb || isList);
  const colCount = (showCheckbox ? 1 : 0) + 5; // created, customer, items, courier, action

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {showCheckbox && (
              <th className="p-3 w-10">
                <input type="checkbox" checked={!!allChecked} onChange={onToggleAll} />
              </th>
            )}
            <th className="text-left p-3">Created At</th>
            <th className="text-left p-3">Customer</th>
            <th className="text-left p-3">Order Items</th>
            <th className="text-left p-3">Courier Success Rate</th>
            <th className="text-right p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={colCount} className="p-2"><BrandLoader /></td></tr>
          )}
          {!loading && orders.map((o) => {
            const wa = waNumber(o.customer_phone);
            const inv = (o.invoice_no ?? o.id.slice(0, 8)).toUpperCase();
            const items = o.order_items ?? [];
            return (
              <tr key={o.id} className="border-t hover:bg-muted/50 align-top">
                {showCheckbox && (
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds!.has(o.id)}
                      onChange={() => onToggleOne!(o.id)}
                    />
                  </td>
                )}
                {/* Created At */}
                <td className="p-3 text-xs whitespace-nowrap min-w-[140px]">
                  <div className="font-semibold">{format(new Date(o.created_at), "dd MMM, hh:mm a")}</div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5">ID: {inv}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {o.printed_at && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold">Printed</span>}
                    {o.courier_consignment && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold" title="Courier Consignment ID">{o.courier_consignment}</span>}
                  </div>
                </td>
                {/* Customer */}
                <td className="p-3 min-w-[220px]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono">{o.customer_phone}</span>
                      <a href={`tel:${o.customer_phone}`} className="p-1 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100" title="কল"><Phone className="w-3 h-3" /></a>
                      {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="p-1 rounded-full bg-green-50 text-green-600 hover:bg-green-100" title="WhatsApp"><MessageCircle className="w-3 h-3" /></a>}
                    </div>
                    <div className="font-semibold">{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {[o.customer_address, o.thana, o.district].filter(Boolean).join(", ")}
                    </div>
                    <RelativeUpdatedTime value={o.updated_at ?? o.created_at} />
                  </div>
                </td>
                {/* Order Items: first 3 images + popover for the rest */}
                <td className="p-3 min-w-[140px]">
                  <OrderItemsThumbs items={items} />
                  <div className="text-xs font-bold pt-1.5 mt-1.5 border-t">টোটাল: {taka(o.total)}</div>
                </td>
                {/* Courier Success Rate */}
                <td className="p-3 min-w-[180px]">
                  <CourierSuccessCell phone={o.customer_phone} />
                </td>
                {/* Action */}
                <td className="p-3 text-right">
                  {(() => {
                    const lock = lockMap?.get(o.id);
                    const lockedByOther = lock && lock.user_id !== currentUserId;
                    const linkSearch = { tab: (isWeb ? "web" : "list") as "web" | "list", selected: o.id };
                    const handleClick = (e: MouseEvent) => {
                      if (!e.metaKey && !e.ctrlKey && e.button === 0) { e.preventDefault(); onOpen(o.id); }
                    };
                    const creatorName = o.created_by ? creatorMap?.get(o.created_by) : undefined;
                    if (lockedByOther) {
                      return (
                        <div className="flex flex-col items-end">
                          <Link to="/admin/orders" search={linkSearch} onClick={handleClick} className="inline-flex flex-col items-end gap-0.5 px-2.5 py-1.5 rounded border border-red-300 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 animate-pulse" title={`${lock.user_name} এই অর্ডারটি ওপেন করেছেন — ক্লিক করলে ওয়ারনিং + টেকওভার অপশন আসবে`}>
                            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />লকড · Open</span>
                            <span className="text-[10px] font-normal text-red-600 max-w-[140px] truncate">{lock.user_name}</span>
                          </Link>
                          {creatorName && <span className="text-[10px] text-red-600 font-semibold mt-1 max-w-[150px] truncate">Created by: {creatorName}</span>}
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-col items-end">
                        <Link to="/admin/orders" search={linkSearch} onClick={handleClick} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100" title="অর্ডার ওপেন (রাইট ক্লিক / নতুন ট্যাবে খুলুন)">
                          Open <ExternalLink className="w-3 h-3" />
                        </Link>
                        {creatorName && <span className="text-[10px] text-red-600 font-semibold mt-1 max-w-[150px] truncate">Created by: {creatorName}</span>}
                      </div>
                    );
                  })()}
                </td>
              </tr>
            );
          })}
          {!loading && !orders.length && (
            <tr><td colSpan={colCount} className="p-8 text-center text-muted-foreground">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────── New Order Panel ───────────────── */
type Cart = { product_id: string; product_name: string; price: number; quantity: number };

function NewOrderPanel({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [thana, setThana] = useState("");
  const [district, setDistrict] = useState("");
  const [notes, setNotes] = useState("");
  const [delivery, setDelivery] = useState(60);
  const [items, setItems] = useState<Cart[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoFilledFor, setAutoFilledFor] = useState<string>("");
  const createOrder = useServerFn(createManualOrder);

  // Customer history (auto-fill when phone has 10+ digits)
  const phoneDigits = normalizePhone(phone);
  const phoneReady = phoneDigits.length >= 10;
  const courierHistoryFn = useServerFn(fetchCourierHistory);
  const { data: history } = useQuery({
    queryKey: ["new-order-history", phoneDigits],
    enabled: phoneReady,
    queryFn: async () => {
      const phones = phoneVariants(phone);
      const { data } = await supabase
        .from("orders")
        .select("id,invoice_no,status,total,customer_name,customer_address,thana,district,created_at,order_items(product_name,quantity)")
        .in("customer_phone", phones)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Auto-fill from latest order once per unique phone
  if (phoneReady && history && history.length && autoFilledFor !== phoneDigits) {
    const latest = history[0];
    if (!name) setName(latest.customer_name ?? "");
    if (!address) setAddress(latest.customer_address ?? "");
    if (!thana && latest.thana) setThana(latest.thana);
    if (!district && latest.district) setDistrict(latest.district);
    setAutoFilledFor(phoneDigits);
  }

  const historyTotal = history?.length ?? 0;
  const historyCancelled = (history ?? []).filter((o) => o.status === "cancelled" || o.status === "returned").length;
  const historyWebCancel = (history ?? []).filter((o) => o.status === "cancelled").length;

  const { data: extHistory, isFetching: courierLoading } = useQuery({
    queryKey: ["hoorin-courier-history", phoneDigits],
    enabled: phoneReady,
    queryFn: () => courierHistoryFn({ data: { phone: phoneDigits } }),
    staleTime: 5 * 60_000,
  });
  const courierStats = extHistory?.configured ? extHistory.stats : [];
  const overallTotal = courierStats.reduce((a, s) => a + s.total, 0);
  const overallSuccess = courierStats.reduce((a, s) => a + s.success, 0);
  const overallCancelled = courierStats.reduce((a, s) => a + s.cancelled, 0);
  const hoorinError = extHistory?.error ?? null;
  const hoorinReady = !!extHistory?.configured;

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data: products } = useQuery({
    queryKey: ["new-order-products", debouncedSearch],
    queryFn: async () => {
      let q = supabase.from("products").select("id,name,price,sale_price,sku").eq("is_active", true).limit(20);
      if (debouncedSearch) q = q.ilike("name", `%${debouncedSearch}%`);
      return (await q).data ?? [];
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const subtotal = useMemo(() => items.reduce((a, i) => a + i.price * i.quantity, 0), [items]);
  const total = subtotal + Number(delivery || 0);

  const addItem = (p: { id: string; name: string; price: number; sale_price: number | null }) => {
    const price = p.sale_price ?? p.price;
    setItems((prev) => {
      const exist = prev.find((x) => x.product_id === p.id);
      if (exist) return prev.map((x) => x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...prev, { product_id: p.id, product_name: p.name, price, quantity: 1 }];
    });
  };

  const submit = async () => {
    if (!name || !phone) return toast.error("নাম ও ফোন দিন");
    if (!items.length) return toast.error("অন্তত একটি প্রোডাক্ট যোগ করুন");
    setSaving(true);
    try {
      await createOrder({
        data: {
          customer_name: name,
          customer_phone: phone,
          customer_address: address,
          thana,
          district,
          notes,
          subtotal,
          delivery_fee: delivery,
          discount: 0,
          total,
          items: items.map((i) => ({ product_id: i.product_id, product_name: i.product_name, price: i.price, quantity: i.quantity })),
        },
      });
      toast.success("অর্ডার তৈরি হয়েছে");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ব্যর্থ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Customer history strip — appears as soon as phone is entered */}
      {phoneReady && (
        <div className="bg-white border rounded-xl p-3">
          <div className="text-xs font-semibold mb-2 text-muted-foreground">
            {historyTotal > 0 ? "এই কাস্টমারের আগের রেকর্ড" : "নতুন কাস্টমার — কোনো আগের অর্ডার নেই"}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <OurRecordCard history={history ?? []} total={historyTotal} success={historyTotal - historyCancelled} cancelled={historyCancelled} />
            <div className="min-w-[150px] rounded-lg border p-2.5 bg-white text-xs">
              <div className="font-bold text-sm">Web Cancel</div>
              <div className="text-rose-600 font-semibold mt-2">{historyWebCancel}</div>
              <div className="text-muted-foreground">এই কাস্টমারের</div>
            </div>
            <CourierCard name="Overall" total={overallTotal} success={overallSuccess} cancelled={overallCancelled} />
            {courierStats.map((c) => (
              <CourierCard key={c.name} name={c.name} total={c.total} success={c.success} cancelled={c.cancelled} />
            ))}
            {courierLoading && null}
            {!courierLoading && hoorinError && <div className="min-w-[220px] rounded-lg border border-dashed p-2.5 bg-amber-50 text-xs text-amber-800 self-center">Hoorin error: {hoorinError}</div>}
            {!courierLoading && !hoorinError && hoorinReady && courierStats.length === 0 && <div className="min-w-[200px] rounded-lg border border-dashed p-2.5 bg-muted/40 text-xs text-muted-foreground self-center">এই নাম্বারে কোনো কুরিয়ার রেকর্ড নেই</div>}
            {!courierLoading && !hoorinError && !hoorinReady && <div className="min-w-[220px] rounded-lg border border-dashed p-2.5 bg-amber-50 text-xs text-amber-800 self-center">Hoorin API কানেক্ট নেই — All API তে কী বসান</div>}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
      {/* Customer + items pick */}
      <div className="space-y-4">
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h3 className="font-bold">কাস্টমার তথ্য</h3>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ফোন নাম্বার *" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="নাম *" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ঠিকানা" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder="থানা" value={thana} onChange={(e) => setThana(e.target.value)} />
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder="জেলা" value={district} onChange={(e) => setDistrict(e.target.value)} />
          </div>
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="নোট (অপশনাল)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h3 className="font-bold">প্রোডাক্ট খুঁজুন</h3>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="প্রোডাক্ট নাম দিন..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-60 overflow-y-auto divide-y">
            {products?.map((p) => (
              <button key={p.id} onClick={() => addItem(p)} className="w-full flex justify-between items-center py-2 text-left hover:bg-muted px-2 rounded">
                <div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.sku ?? ""}</div>
                </div>
                <div className="text-sm font-bold">{taka(p.sale_price ?? p.price)}</div>
              </button>
            ))}
            {!products?.length && <p className="text-sm text-muted-foreground py-4 text-center">কোনো প্রোডাক্ট নেই</p>}
          </div>
        </div>
      </div>

      {/* Cart + summary */}
      <div className="space-y-4">
        <div className="bg-white border rounded-xl p-4">
          <h3 className="font-bold mb-3">কার্ট ({items.length})</h3>
          {!items.length && <p className="text-sm text-muted-foreground py-6 text-center">প্রোডাক্ট যোগ করুন</p>}
          {items.map((i, idx) => (
            <div key={i.product_id} className="flex items-center gap-2 py-2 border-b">
              <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{i.product_name}</div><div className="text-xs text-muted-foreground">পণ্যের মূল্য কাস্টমাইজ করা যাবে</div></div>
              <div className="w-24"><div className="text-[10px] text-muted-foreground mb-0.5">Price</div><input type="number" min={0} step="0.01" value={i.price} onChange={(e) => { const price = Math.max(0, Number(e.target.value)); setItems((prev) => prev.map((x, ix) => ix === idx ? { ...x, price } : x)); }} className="w-full border rounded px-2 py-1 text-sm font-semibold" /></div>
              <div className="w-16"><div className="text-[10px] text-muted-foreground mb-0.5">Qty</div><input type="number" min={1} value={i.quantity} onChange={(e) => { const qty = Math.max(1, Number(e.target.value)); setItems((prev) => prev.map((x, ix) => ix === idx ? { ...x, quantity: qty } : x)); }} className="w-full border rounded px-2 py-1 text-sm" /></div>
              <div className="w-20 text-right"><div className="text-[10px] text-muted-foreground">Total</div><div className="text-sm font-bold">{taka(i.price * i.quantity)}</div></div>
              <button onClick={() => setItems((prev) => prev.filter((_, ix) => ix !== idx))} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div className="bg-white border rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm"><span>সাবটোটাল</span><span>{taka(subtotal)}</span></div>
          <div className="flex justify-between text-sm items-center">
            <span>ডেলিভারি ফি</span>
            <input type="number" value={delivery} onChange={(e) => setDelivery(Number(e.target.value))} className="w-24 border rounded px-2 py-1 text-sm text-right" />
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2"><span>মোট</span><span className="text-brand-dark">{taka(total)}</span></div>
          <button onClick={submit} disabled={saving} className="w-full bg-brand text-white py-2.5 rounded-lg font-bold mt-2 disabled:opacity-50">
            {saving ? "সেভ হচ্ছে..." : "অর্ডার ক্রিয়েট করুন"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

/* ───────────────── Detail / Open Order Modal ───────────────── */
type DetailItem = { id: string; product_id: string | null; product_name: string; quantity: number; price: number; subtotal: number };
type DetailOrder = {
  id: string; invoice_no: string | null; status: OrderStatus;
  customer_name: string; customer_phone: string; customer_address: string | null;
  thana: string | null; district: string | null; notes: string | null;
  subtotal: number; delivery_fee: number; discount: number; total: number;
  created_at: string; order_items: DetailItem[];
  assigned_to?: string | null;
  originated_from_incomplete?: boolean | null;
};


const COURIERS = ["Steadfast", "Pathao", "RedX", "eCourier", "Paperfly"] as const;
type Courier = typeof COURIERS[number];

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("88") && digits.length === 13) return digits.slice(2);
  return digits;
}

function phoneVariants(phone: string) {
  const digits = normalizePhone(phone);
  const variants = [phone.trim(), digits, digits ? `88${digits}` : ""].filter(Boolean);
  return Array.from(new Set(variants));
}

function CourierCard({ name, total, success, cancelled, highlight, clickable }: { name: string; total: number; success: number; cancelled: number; highlight?: boolean; clickable?: boolean }) {
  const rate = total > 0 ? Math.round((success / total) * 100) : 0;
  return (
    <div className={`min-w-[150px] rounded-lg border p-2.5 text-xs space-y-1 ${highlight ? "bg-cyan-50 border-cyan-300" : "bg-white"} ${clickable ? "cursor-pointer hover:shadow-md hover:border-cyan-500 transition" : ""}`}>
      <div className="font-bold text-sm text-foreground flex items-center justify-between gap-1">
        <span>{name}</span>
        {clickable && total > 0 && <span className="text-[9px] font-normal text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded">দেখুন</span>}
      </div>
      <div className="text-emerald-600 font-semibold">Success Rate: {rate}%</div>
      <div className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{total}</span></div>
      <div className="text-emerald-700">Success: <span className="font-semibold">{success}</span></div>
      <div className="text-rose-600">Cancelled: <span className="font-semibold">{cancelled}</span></div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
        <div className="h-full bg-emerald-500" style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

type HistoryOrder = {
  id: string;
  invoice_no?: string | null;
  status: string;
  total: number | string;
  created_at: string;
  customer_name?: string | null;
  customer_address?: string | null;
  thana?: string | null;
  district?: string | null;
  order_items?: { product_name: string; quantity: number }[] | null;
};

function OurRecordCard({ history, total, success, cancelled }: { history: HistoryOrder[]; total: number; success: number; cancelled: number }) {
  if (total === 0) {
    return <CourierCard name="Our Record" total={0} success={0} cancelled={0} highlight />;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-left">
          <CourierCard name="Our Record" total={total} success={success} cancelled={cancelled} highlight clickable />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px] max-w-[94vw] p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gradient-to-r from-cyan-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div className="font-bold text-sm text-slate-800">আগের অর্ডার সমূহ</div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-cyan-200 text-cyan-700">মোট {total}</span>
          </div>
          <div className="flex gap-3 mt-1.5 text-[11px]">
            <span className="text-emerald-700 font-semibold">✓ সফল: {success}</span>
            <span className="text-rose-600 font-semibold">✕ বাতিল: {cancelled}</span>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y bg-white">
          {history.slice(0, 30).map((o) => {
            const items = o.order_items ?? [];
            const addr = [o.customer_address, o.thana, o.district].filter(Boolean).join(", ");
            return (
              <div key={o.id} className="px-4 py-3 text-xs hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <div className="font-bold text-slate-800 text-[12px]">
                      {o.invoice_no ? `#${o.invoice_no}` : "Draft"}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      {format(new Date(o.created_at), "dd MMM yyyy, hh:mm a")}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${statusColor[o.status as OrderStatus] ?? "bg-gray-100 text-gray-700"}`}>
                    {statusEn[o.status as OrderStatus] ?? o.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 mb-1">
                  <span className="font-semibold">{o.customer_name || "—"}</span>
                  {addr && <span className="text-muted-foreground"> · {addr}</span>}
                </div>
                {items.length > 0 && (
                  <ul className="text-[11px] text-muted-foreground space-y-0.5 mb-1.5 pl-1">
                    {items.map((it, i) => (
                      <li key={i} className="truncate">• {it.product_name} × {it.quantity}</li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center justify-between border-t pt-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">মোট</span>
                  <span className="text-[12px] font-bold text-slate-900">{taka(Number(o.total))}</span>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}


function DetailModal({ id, onClose, onConfirmed }: { id: string; onClose: () => void; onConfirmed?: () => void }) {
  const qc = useQueryClient();
  const updateOrder = useServerFn(updateAdminOrder);
  const reserveInvoices = useServerFn(reserveInvoiceNos);
  const acquire = useServerFn(acquireOrderLock);
  const heartbeat = useServerFn(heartbeatOrderLock);
  const release = useServerFn(releaseOrderLock);

  // Draft mode: id like "inc:<uuid>" — no real order exists yet.
  const isDraft = id.startsWith("inc:");
  const incId = isDraft ? id.slice(4) : null;

  const [lockState, setLockState] = useState<"checking" | "ok" | "blocked">(isDraft ? "ok" : "checking");
  const [lockedBy, setLockedBy] = useState<string>("");

  // Acquire lock on open (skip in draft mode — no real order yet)
  useEffect(() => {
    if (isDraft) return;
    let mounted = true;
    (async () => {
      try {
        const res = await acquire({ data: { order_id: id } });
        if (!mounted) return;
        if (res.ok) { setLockState("ok"); }
        else { setLockedBy(res.locked_by ?? "অন্য একজন"); setLockState("blocked"); }
      } catch { if (mounted) setLockState("ok"); }
    })();
    return () => { mounted = false; };
  }, [id, acquire, isDraft]);

  // Heartbeat every 25s while open
  useEffect(() => {
    if (isDraft || lockState !== "ok") return;
    const t = setInterval(() => { heartbeat({ data: { order_id: id } }).catch(() => {}); }, 25_000);
    return () => clearInterval(t);
  }, [lockState, id, heartbeat, isDraft]);

  // Release on close
  useEffect(() => {
    if (isDraft) return;
    return () => { release({ data: { order_id: id } }).catch(() => {}); };
  }, [id, release, isDraft]);

  const doTakeover = async () => {
    setLockState("checking");
    const res = await acquire({ data: { order_id: id, takeover: true } });
    if (res.ok) setLockState("ok"); else { setLockedBy(res.locked_by ?? ""); setLockState("blocked"); }
  };

  const { data: detail } = useQuery<DetailOrder | null>({
    queryKey: ["order-detail", id],
    enabled: lockState === "ok",
    queryFn: async () => {
      if (isDraft && incId) {
        const { data } = await supabase.from("incomplete_orders").select("*").eq("id", incId).maybeSingle();
        if (!data) return null;
        const r = data as any;
        const its = (r.items ?? []) as Array<{ name: string; price: number; quantity: number; product_id?: string | null }>;
        const subtotal = its.reduce((a, i) => a + Number(i.price) * Number(i.quantity), 0);
        const draft: DetailOrder = {
          id,
          invoice_no: null,
          status: "incomplete" as OrderStatus,
          customer_name: r.customer_name || "",
          customer_phone: r.phone,
          customer_address: r.customer_address ?? null,
          thana: null,
          district: r.delivery_zone ?? null,
          notes: r.note ?? null,
          subtotal,
          delivery_fee: Number(r.delivery_fee ?? 0),
          discount: 0,
          total: Number(r.total ?? 0),
          created_at: r.created_at,
          order_items: its.map((it, idx) => ({
            id: `${incId}-${idx}`,
            product_id: it.product_id ?? null,
            product_name: it.name,
            quantity: Number(it.quantity ?? 1),
            price: Number(it.price ?? 0),
            subtotal: Number(it.price) * Number(it.quantity),
          })),
        };
        return draft;
      }
      const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
      return (data as unknown as DetailOrder | null) ?? null;
    },
  });


  // Editable form state
  const [name, setName] = useState("");
  const [phoneVal, setPhoneVal] = useState("");
  const [address, setAddress] = useState("");
  const [shippingNote, setShippingNote] = useState("");
  const [delivery, setDelivery] = useState<Courier>("Steadfast");
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [items, setItems] = useState<DetailItem[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);


  // Customer history by phone — updates immediately when the mobile number field changes.
  const lookupPhoneDigits = normalizePhone(phoneVal || detail?.customer_phone || "");
  const lookupPhone = phoneVal || detail?.customer_phone || "";
  const { data: history } = useQuery({
    queryKey: ["customer-history", lookupPhoneDigits],
    enabled: lookupPhoneDigits.length >= 10,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("id,invoice_no,status,total,created_at,customer_name,customer_address,thana,district,order_items(product_name,quantity)").in("customer_phone", phoneVariants(lookupPhone)).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Hydrate when detail loads
  useEffect(() => {
    if (!detail) return;
    setName(detail.customer_name);
    setPhoneVal(detail.customer_phone);
    setAddress([detail.customer_address, detail.thana, detail.district].filter(Boolean).join(", "));
    setShippingNote(detail.notes ?? "");
    setDiscount(Number(detail.discount) || 0);
    setDeliveryCharge(Number(detail.delivery_fee) || 0);
    setItems(detail.order_items ?? []);
    setAssignedTo(detail.assigned_to ?? null);
  }, [detail]);


  const debouncedSearch = useDebouncedValue(search, 300);
  const { data: products } = useQuery({
    queryKey: ["open-order-products", debouncedSearch],
    queryFn: async () => {
      let q = supabase.from("products").select("id,name,price,sale_price,sku,images,stock").eq("is_active", true).limit(20);
      if (debouncedSearch) q = q.ilike("name", `%${debouncedSearch}%`);
      return (await q).data ?? [];
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const subtotal = useMemo(() => items.reduce((a, i) => a + Number(i.price) * i.quantity, 0), [items]);
  const grand = subtotal - Number(discount || 0) + Number(deliveryCharge || 0);

  // History stats — exclude the order currently being viewed
  const otherHistory = useMemo(() => (history ?? []).filter((o) => o.id !== detail?.id), [history, detail?.id]);
  const historyTotal = otherHistory.length;
  const historyCancelled = otherHistory.filter((o) => o.status === "cancelled" || o.status === "returned").length;
  const historyWebCancel = otherHistory.filter((o) => o.status === "cancelled").length;


  // Real courier history via BD Courier Check API (configured in /admin/all-api)
  const courierHistoryFn = useServerFn(fetchCourierHistory);
  const { data: extHistory } = useQuery({
    queryKey: ["hoorin-courier-history", lookupPhoneDigits],
    enabled: lookupPhoneDigits.length >= 10,
    queryFn: () => courierHistoryFn({ data: { phone: lookupPhoneDigits } }),
    staleTime: 5 * 60_000,
  });

  // Per-courier stats come ONLY from Hoorin API. No fallback / no synthetic distribution.
  const courierStats: { name: string; total: number; success: number; cancelled: number }[] =
    extHistory?.configured ? extHistory.stats : [];

  // Overall = sum of all couriers from Hoorin only. Independent of "Our Record".
  const overallTotal = courierStats.reduce((a, s) => a + s.total, 0);
  const overallSuccess = courierStats.reduce((a, s) => a + s.success, 0);
  const overallCancelled = courierStats.reduce((a, s) => a + s.cancelled, 0);
  const hoorinError = extHistory?.error ?? null;
  const hoorinReady = !!extHistory?.configured;

  const addItem = (p: { id: string; name: string; price: number; sale_price: number | null }) => {
    const price = p.sale_price ?? p.price;
    setItems((prev) => {
      const exist = prev.find((x) => x.product_id === p.id);
      if (exist) return prev.map((x) => x.product_id === p.id ? { ...x, quantity: x.quantity + 1, subtotal: (x.quantity + 1) * Number(x.price) } : x);
      return [...prev, { id: crypto.randomUUID(), product_id: p.id, product_name: p.name, price, quantity: 1, subtotal: price }];
    });
  };

  const updateItem = (idx: number, patch: Partial<DetailItem>) => {
    setItems((prev) => prev.map((x, i) => {
      if (i !== idx) return x;
      const next = { ...x, ...patch };
      next.subtotal = Number(next.price) * next.quantity;
      return next;
    }));
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const save = async (confirm = false) => {
    if (!detail) return;
    setSaving(true);
    try {
      if (isDraft && incId) {
        if (!confirm) {
          // Update the incomplete row in place
          const { error } = await supabase.from("incomplete_orders").update({
            customer_name: name || null,
            phone: phoneVal,
            customer_address: address || null,
            delivery_zone: detail.district,
            delivery_fee: deliveryCharge,
            subtotal,
            total: grand,
            note: shippingNote || null,
            items: items.map((i) => ({ name: i.product_name, price: Number(i.price), quantity: i.quantity, product_id: i.product_id })),
          }).eq("id", incId);
          if (error) throw new Error(error.message);
          toast.success("ড্রাফট সেভ হয়েছে");
        } else {
          // Promote to a real order with status='pending'
          if (!items.length) throw new Error("কমপক্ষে ১টি প্রোডাক্ট যোগ করুন");
          if (!name.trim()) throw new Error("কাস্টমারের নাম দিন");
          const { invoices } = await reserveInvoices({ data: { count: 1 } });
          const { data: created, error } = await supabase
            .from("orders")
            .insert({
              invoice_no: invoices[0],
              customer_name: name,
              customer_phone: phoneVal,
              customer_address: address || null,
              thana: null,
              district: detail.district,
              notes: shippingNote || null,
              subtotal,
              delivery_fee: deliveryCharge,
              discount,
              total: grand,
              source: "web",
              status: "pending",
              payment_method: "cod",
            })
            .select("id")
            .single();
          if (error || !created) throw new Error(error?.message ?? "অর্ডার তৈরি ব্যর্থ");
          const rowsIns = items.map((i) => ({
            order_id: created.id,
            product_id: i.product_id ?? null,
            product_name: i.product_name,
            quantity: i.quantity,
            price: Number(i.price),
            subtotal: Number(i.price) * i.quantity,
          }));
          const { error: itErr } = await supabase.from("order_items").insert(rowsIns);
          if (itErr) throw new Error(itErr.message);
          await supabase.from("incomplete_orders").delete().eq("id", incId);
          toast.success("অর্ডার তৈরি হয়েছে — অর্ডার লিস্টের পেন্ডিং এ গেছে");
        }
        qc.invalidateQueries({ queryKey: ["admin-orders-incomplete"] });
        qc.invalidateQueries({ queryKey: ["incomplete-count"] });
        qc.invalidateQueries({ queryKey: ["order-status-counts"] });
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
        if (confirm) onConfirmed?.();
        return;
      }
      await updateOrder({
        data: {
          id: detail.id,
          confirm,
          customer_name: name,
          customer_phone: phoneVal,
          customer_address: address,
          thana: detail.thana,
          district: detail.district,
          notes: shippingNote,
          subtotal,
          delivery_fee: deliveryCharge,
          discount,
          total: grand,
          items: items.map((i) => ({ product_id: i.product_id, product_name: i.product_name, price: Number(i.price), quantity: i.quantity })),
        },
      });
      toast.success(confirm ? "অর্ডার তৈরি হয়েছে — অর্ডার লিস্টে গেছে" : "অর্ডার আপডেট হয়েছে");
      qc.invalidateQueries({ queryKey: ["order-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      if (confirm) onConfirmed?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ব্যর্থ");
    } finally {
      setSaving(false);
    }
  };
  



  if (lockState === "blocked") {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center border-2 border-red-500" onClick={(e) => e.stopPropagation()}>
          <div className="text-red-600 font-bold text-lg mb-2">⚠ অর্ডারটি অন্য একজন এডিট করছেন</div>
          <div className="text-sm text-muted-foreground mb-4">
            <span className="font-semibold text-foreground">{lockedBy}</span> এই মুহূর্তে এই অর্ডারটি ওপেন করেছেন।
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border font-semibold">বন্ধ করুন</button>
            <button onClick={doTakeover} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold">টেকওভার</button>
          </div>
        </div>
      </div>
    );
  }

  if (lockState === "checking" || !detail) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded-xl p-2"><BrandLoader /></div>
      </div>
    );
  }

  const wa = waNumber(phoneVal);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-start justify-center p-2 sm:p-4">
        <div className="bg-white rounded-xl w-full max-w-5xl my-4" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          {(isDraft || !!detail?.originated_from_incomplete) && (
            <div className="px-5 py-3 border-b-2 border-red-200 bg-red-50 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-red-600">INCOMPLETE ORDER</div>
            </div>
          )}
          <div className="px-5 py-3 border-b flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-xl">
            <div className="flex items-center gap-3">
              <span className="font-bold">New Order</span>
              <span className="text-xs text-muted-foreground">#{(detail.invoice_no ?? detail.id.slice(0, 8)).toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-3">
              <a className="text-blue-600 text-sm hover:underline hidden sm:inline" href="#">How to Take New Order?</a>
              <button onClick={onClose} className="text-2xl leading-none">×</button>
            </div>
          </div>

          {/* Courier history strip */}
          <div className="p-4 border-b">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <OurRecordCard history={otherHistory} total={historyTotal} success={historyTotal - historyCancelled} cancelled={historyCancelled} />

              <div className="min-w-[150px] rounded-lg border p-2.5 bg-white text-xs">
                <div className="font-bold text-sm">Web Cancel</div>
                <div className="text-rose-600 font-semibold mt-2">{historyWebCancel}</div>
                <div className="text-muted-foreground">এই কাস্টমারের</div>
              </div>
              <CourierCard name="Overall" total={overallTotal} success={overallSuccess} cancelled={overallCancelled} />
              {courierStats.map((c) => (
                <CourierCard key={c.name} name={c.name} total={c.total} success={c.success} cancelled={c.cancelled} />
              ))}
              {hoorinError && (
                <div className="min-w-[220px] rounded-lg border border-dashed p-2.5 bg-amber-50 text-xs text-amber-800 self-center">
                  Hoorin error: {hoorinError}
                </div>
              )}
              {!hoorinError && hoorinReady && courierStats.length === 0 && (
                <div className="min-w-[200px] rounded-lg border border-dashed p-2.5 bg-muted/40 text-xs text-muted-foreground self-center">
                  Hoorin: এই নাম্বারে কোনো কুরিয়ার রেকর্ড নেই
                </div>
              )}
              {!hoorinError && !hoorinReady && (
                <div className="min-w-[220px] rounded-lg border border-dashed p-2.5 bg-amber-50 text-xs text-amber-800 self-center">
                  Hoorin API কানেক্ট নেই — All API তে কী বসান
                </div>
              )}
            </div>
          </div>

          {/* Customer fields */}
          <div className="p-4 grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block">Mobile Number</label>
              <div className="flex items-center gap-1">
                <input value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm bg-blue-50/40" />
                <a href={`tel:${phoneVal}`} className="p-2 rounded-full bg-blue-50 text-blue-600" title="Call"><Phone className="w-4 h-4" /></a>
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="p-2 rounded-full bg-green-50 text-green-600" title="WhatsApp"><MessageCircle className="w-4 h-4" /></a>}
              </div>
              <p className="text-[11px] text-blue-600 mt-1">Check Our Record above for customer history</p>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-blue-50/40" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Delivery Method</label>
              <select value={delivery} onChange={(e) => setDelivery(e.target.value as Courier)} className="w-full border rounded-lg px-3 py-2 text-sm bg-blue-50/40">
                {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs font-semibold mb-1 block">Address</label>
              <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-blue-50/40" />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs font-semibold mb-1 block">Shipping Note</label>
              <textarea rows={3} value={shippingNote} onChange={(e) => setShippingNote(e.target.value)} maxLength={350} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="text-[11px] text-right text-muted-foreground">{shippingNote.length}/350</div>
            </div>

          </div>


          {/* Products: ordered + add */}
          <div className="p-4 grid lg:grid-cols-2 gap-4 border-t">
            <div className="bg-white border rounded-xl p-3">
              <h3 className="font-bold mb-2">Ordered Products <span className="text-xs text-muted-foreground">({items.length})</span></h3>
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {items.map((i, idx) => (
                  <div key={i.id} className="border rounded-lg p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold flex-1">{i.product_name}</div>
                      <button onClick={() => removeItem(idx)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Qty</div>
                        <input type="number" min={1} value={i.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                          className="w-full border rounded px-2 py-1" />
                      </div>
                      <div>
                        <div className="text-muted-foreground">Price</div>
                        <input type="number" value={i.price}
                          onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                          className="w-full border rounded px-2 py-1" />
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total</div>
                        <input readOnly value={(Number(i.price) * i.quantity).toFixed(2)} className="w-full border rounded px-2 py-1 bg-muted" />
                      </div>
                    </div>
                  </div>
                ))}
                {!items.length && <p className="text-sm text-muted-foreground py-6 text-center">প্রোডাক্ট যোগ করুন</p>}
              </div>
            </div>

            <div className="bg-white border rounded-xl p-3">
              <h3 className="font-bold mb-2">Click To Add Products</h3>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to search..." className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
              <div className="space-y-1 max-h-[360px] overflow-y-auto">
                {products?.map((p) => (
                  <button key={p.id} onClick={() => addItem(p)} className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded-lg text-left">
                    {p.images?.[0] && <img src={p.images[0]} className="w-10 h-10 rounded object-cover" alt="" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">SKU: {p.sku ?? "—"} · Stock: {p.stock}</div>
                    </div>
                    <div className="text-sm font-bold whitespace-nowrap">{taka(p.sale_price ?? p.price)}</div>
                  </button>
                ))}
                {!products?.length && <p className="text-sm text-muted-foreground py-4 text-center">কোনো প্রোডাক্ট নেই</p>}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="p-4 border-t grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block">Discount</label>
              <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Advance</label>
              <input type="number" value={advance} onChange={(e) => setAdvance(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Sub Total</label>
              <input readOnly value={subtotal.toFixed(2)} className="w-full border rounded-lg px-3 py-2 text-sm bg-muted" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">Delivery Charge</label>
              <input type="number" value={deliveryCharge} onChange={(e) => setDeliveryCharge(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold mb-1 block text-pink-600">Grand Total</label>
              <input readOnly value={grand.toFixed(2)} className="w-full border rounded-lg px-3 py-2 text-sm bg-muted font-bold" />
            </div>
          </div>

          <div className="p-4 border-t sticky bottom-0 bg-white rounded-b-xl">
            {(() => {
              const isWebStage = detail.status === "web_pending" || detail.status === "incomplete" || detail.status === "hold";
              const label = isWebStage
                ? `Create Order (${grand.toFixed(2)}৳)`
                : `আপডেট করুন (${grand.toFixed(2)}৳)`;
              return (
                <button
                  onClick={() => save(isWebStage)}
                  disabled={saving}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-bold disabled:opacity-50"
                >
                  {saving ? "সেভ হচ্ছে..." : label}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
