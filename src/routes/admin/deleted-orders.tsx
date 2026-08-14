import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ArrowLeft, Loader2, PackageOpen, Phone, Search, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { taka } from "@/lib/format";
import {
  bulkPermanentlyDeleteArchivedOrders,
  bulkRestoreDeletedOrders,
  listDeletedOrders,
  permanentlyDeleteArchivedOrder,
  restoreDeletedOrder,
} from "@/lib/deleted-order.functions";

export const Route = createFileRoute("/admin/deleted-orders")({
  component: DeletedOrdersPage,
});

type RestoreStatus =
  | "web_pending"
  | "pending"
  | "rts"
  | "shipped"
  | "delivered"
  | "pending_return"
  | "returned"
  | "partial"
  | "cancelled"
  | "hold";

type ArchivedItem = {
  id?: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price?: number | string;
};

type DeletedOrderRow = {
  id: string;
  invoice_no: string | null;
  original_status: string;
  customer_name: string;
  customer_phone: string;
  total: number | string;
  original_created_at: string;
  deleted_at: string;
  items: ArchivedItem[] | null;
};

const STATUS_OPTIONS: { value: RestoreStatus; label: string }[] = [
  { value: "web_pending", label: "ওয়েব পেন্ডিং" },
  { value: "pending", label: "পেন্ডিং" },
  { value: "rts", label: "RTS (রেডি)" },
  { value: "shipped", label: "শিপড" },
  { value: "delivered", label: "ডেলিভার্ড" },
  { value: "pending_return", label: "রিটার্ন পেন্ডিং" },
  { value: "returned", label: "রিটার্নড" },
  { value: "partial", label: "পার্শিয়াল" },
  { value: "cancelled", label: "ক্যান্সেলড" },
  { value: "hold", label: "হোল্ড" },
];

const VALID_STATUSES = new Set(STATUS_OPTIONS.map((item) => item.value));

function preferredStatus(status: string): RestoreStatus {
  return VALID_STATUSES.has(status as RestoreStatus) ? (status as RestoreStatus) : "pending";
}

function DeletedOrdersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDeletedOrders);
  const restoreFn = useServerFn(restoreDeletedOrder);
  const permanentFn = useServerFn(permanentlyDeleteArchivedOrder);
  const bulkRestoreFn = useServerFn(bulkRestoreDeletedOrders);
  const bulkPermanentFn = useServerFn(bulkPermanentlyDeleteArchivedOrders);

  const [search, setSearch] = useState("");
  const [restoreTargets, setRestoreTargets] = useState<Record<string, RestoreStatus>>({});
  const [bulkStatus, setBulkStatus] = useState<RestoreStatus>("pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["deleted-orders"],
    queryFn: () => listFn({}),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const allRows = ((data?.rows ?? []) as DeletedOrderRow[]);
  const term = search.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!term) return allRows;
    return allRows.filter((row) => {
      const invoice = (row.invoice_no ?? row.id.slice(0, 8)).toLowerCase();
      return (
        invoice.includes(term) ||
        row.customer_name.toLowerCase().includes(term) ||
        row.customer_phone.toLowerCase().includes(term)
      );
    });
  }, [allRows, term]);

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  const toggleOne = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) rows.forEach((row) => next.delete(row.id));
      else rows.forEach((row) => next.add(row.id));
      return next;
    });
  };

  const removeManyFromArchiveCache = (ids: string[]) => {
    const removed = new Set(ids);
    qc.setQueryData(["deleted-orders"], (old: any) => {
      if (!old?.rows) return old;
      return { ...old, rows: old.rows.filter((row: DeletedOrderRow) => !removed.has(row.id)) };
    });
    setSelectedIds((current) => new Set(Array.from(current).filter((id) => !removed.has(id))));
  };

  const restore = async (row: DeletedOrderRow) => {
    const status = restoreTargets[row.id] ?? preferredStatus(row.original_status);
    setBusyId(row.id);
    try {
      await restoreFn({ data: { id: row.id, status } });
      removeManyFromArchiveCache([row.id]);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["order-status-counts"] });
      toast.success(`অর্ডার ${STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status} স্ট্যাটাসে ফেরত গেছে`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "রিস্টোর করা যায়নি");
    } finally {
      setBusyId(null);
    }
  };

  const permanentlyDelete = async (row: DeletedOrderRow) => {
    const invoice = row.invoice_no ?? row.id.slice(0, 8).toUpperCase();
    if (!window.confirm(`#${invoice} স্থায়ীভাবে ডিলিট করবেন? এরপর আর কোনোভাবেই ফেরত আনা যাবে না।`)) return;
    setBusyId(row.id);
    try {
      await permanentFn({ data: { id: row.id } });
      removeManyFromArchiveCache([row.id]);
      toast.success("অর্ডার স্থায়ীভাবে ডিলিট হয়েছে");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "পার্মানেন্ট ডিলিট ব্যর্থ");
    } finally {
      setBusyId(null);
    }
  };

  const bulkRestore = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const result = await bulkRestoreFn({ data: { ids, status: bulkStatus } });
      removeManyFromArchiveCache(ids);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["order-status-counts"] });
      toast.success(`${result.restored} টি অর্ডার ${STATUS_OPTIONS.find((s) => s.value === bulkStatus)?.label ?? bulkStatus} স্ট্যাটাসে রিস্টোর হয়েছে`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "একসাথে রিস্টোর করা যায়নি");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkPermanentDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!window.confirm(`${ids.length} টি অর্ডার স্থায়ীভাবে ডিলিট করবেন? এরপর এগুলো আর ফেরত আনা যাবে না।`)) return;
    setBulkBusy(true);
    try {
      const result = await bulkPermanentFn({ data: { ids } });
      removeManyFromArchiveCache(ids);
      toast.success(`${result.deleted} টি অর্ডার স্থায়ীভাবে ডিলিট হয়েছে`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "একসাথে ডিলিট করা যায়নি");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin/orders"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-slate-600 hover:text-brand"
                title="অর্ডারে ফিরুন"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">ট্র্যাশ / ডিলিটেড অর্ডার</h1>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              সাধারণ Delete করলে অর্ডার এখানে নিরাপদে থাকবে। একসাথে সিলেক্ট করে রিস্টোর বা পার্মানেন্ট ডিলিট করা যাবে।
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching || bulkBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-brand/30 disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
            রিফ্রেশ
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ইনভয়েস / নাম / ফোন দিয়ে খুঁজুন"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {rows.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={bulkBusy} />
              সব সিলেক্ট
            </label>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
              {selectedIds.size} টি সিলেক্টেড
            </span>

            {selectedIds.size > 0 && (
              <>
                <select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value as RestoreStatus)}
                  disabled={bulkBusy}
                  className="ml-auto min-w-[160px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}-এ রিস্টোর</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={bulkRestore}
                  disabled={bulkBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand to-brand-dark px-3 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                >
                  {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                  রিস্টোর সিলেক্টেড
                </button>
                {data?.canPermanentDelete && (
                  <button
                    type="button"
                    onClick={bulkPermanentDelete}
                    disabled={bulkBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    ডিলিট সিলেক্টেড
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {isLoading && !data ? (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            ডিলিটেড অর্ডার লোড হচ্ছে...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center">
            <PackageOpen className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            <div className="font-semibold text-slate-700">{term ? "কোনো মিল পাওয়া যায়নি" : "কোনো ডিলিটেড অর্ডার নেই"}</div>
            <div className="mt-1 text-xs text-muted-foreground">ডিলিট করা অর্ডার এখানে দেখা যাবে।</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="px-1 text-xs font-semibold text-muted-foreground">মোট {rows.length} টি ডিলিটেড অর্ডার</div>
            {rows.map((row) => {
              const items = Array.isArray(row.items) ? row.items : [];
              const selectedStatus = restoreTargets[row.id] ?? preferredStatus(row.original_status);
              const busy = busyId === row.id || bulkBusy;
              const invoice = (row.invoice_no ?? row.id.slice(0, 8)).toUpperCase();

              return (
                <div key={row.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition ${selectedIds.has(row.id) ? "border-brand ring-2 ring-brand/10" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        disabled={bulkBusy}
                        className="mt-1"
                        aria-label={`#${invoice} সিলেক্ট করুন`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-extrabold text-slate-800">#{invoice}</span>
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            আগে: {STATUS_OPTIONS.find((s) => s.value === row.original_status)?.label ?? row.original_status}
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-bold text-slate-800">{row.customer_name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <Phone className="h-3 w-3" /> {row.customer_phone}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          অর্ডার: {format(new Date(row.original_created_at), "dd MMM yyyy, hh:mm a")} · ডিলিট: {format(new Date(row.deleted_at), "dd MMM yyyy, hh:mm a")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">মোট</div>
                      <div className="text-lg font-extrabold text-brand-dark">{taka(Number(row.total))}</div>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Order Items</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((item, index) => (
                          <span key={item.id ?? `${row.id}-${index}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                            {item.product_name} × {Number(item.quantity ?? 1)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2 flex-wrap border-t pt-3">
                    <select
                      value={selectedStatus}
                      onChange={(event) => setRestoreTargets((current) => ({ ...current, [row.id]: event.target.value as RestoreStatus }))}
                      disabled={busy}
                      className="min-w-[170px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}-এ ফেরত নিন</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => restore(row)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand to-brand-dark px-3 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                    >
                      {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                      রিস্টোর
                    </button>
                    {data?.canPermanentDelete && (
                      <button
                        type="button"
                        onClick={() => permanentlyDelete(row)}
                        disabled={busy}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        পার্মানেন্ট ডিলিট
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
