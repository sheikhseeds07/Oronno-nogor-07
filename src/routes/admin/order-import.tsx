import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Trash2, ListOrdered, Users, History,
} from "lucide-react";
import { parseOrdersFile, type ParsedOrder } from "@/lib/order-csv";
import { importOrdersFromFile } from "@/lib/order-import.functions";
import { cancelOrders } from "@/lib/admin-order.functions";
import { taka } from "@/lib/format";

export const Route = createFileRoute("/admin/order-import")({
  component: OrderImport,
  head: () => ({
    meta: [
      { title: "ফাইল থেকে অর্ডার ইমপোর্ট | অ্যাডমিন" },
      { name: "description", content: "CSV বা JSON ফাইল আপলোড করে একাধিক অর্ডার একবারে অর্ডার লিস্টে যোগ করুন।" },
    ],
  }),
});

type PrevOrder = {
  id: string;
  invoice_no: string | null;
  customer_name: string;
  customer_phone: string;
  status: string;
  courier_status: string | null;
  total: number;
  created_at: string;
};

const STATUS_BN: Record<string, string> = {
  pending: "পেন্ডিং",
  confirmed: "কনফার্মড",
  processing: "প্রসেসিং",
  shipped: "শিপড (কুরিয়ারে)",
  delivered: "ডেলিভারড",
  partial: "পার্শিয়াল ডেলিভারি",
  cancelled: "বাতিল",
  hold: "হোল্ড",
  returned: "রিটার্ন",
};

const normPhone = (p: string) => (p || "").replace(/\D/g, "").slice(-11);

const bnDate = (iso: string) =>
  new Date(iso).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });

function OrderImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  // duplicate-phone popup (same number appears more than once in the file)
  const [dupOpen, setDupOpen] = useState(false);
  // previous-order popup queue (same number ordered before)
  const [prevQueue, setPrevQueue] = useState<PrevOrder[]>([]);
  const [prevIdx, setPrevIdx] = useState(0);
  const [cancelBusy, setCancelBusy] = useState(false);

  const importFn = useServerFn(importOrdersFromFile);
  const cancelFn = useServerFn(cancelOrders);

  // Groups of rows that share the same phone number
  const dupGroups = useMemo(() => {
    const map = new Map<string, number[]>();
    orders.forEach((o, i) => {
      const key = normPhone(o.customer_phone);
      if (!key) return;
      map.set(key, [...(map.get(key) ?? []), i]);
    });
    return [...map.entries()].filter(([, idxs]) => idxs.length > 1);
  }, [orders]);

  const onFile = async (file: File) => {
    setResult(null);
    setPrevQueue([]);
    const text = await file.text();
    const { orders: parsed, errors } = parseOrdersFile(text, file.name);
    setFileName(file.name);
    setOrders(parsed);
    setParseErrors(errors);
    if (!parsed.length) {
      toast.error("ফাইলে ব্যবহারযোগ্য অর্ডার পাওয়া যায়নি");
      return;
    }
    toast.success(`${parsed.length} টি অর্ডার পড়া হয়েছে`);
    const dupCount = new Set(parsed.map((o) => normPhone(o.customer_phone))).size !== parsed.length;
    if (dupCount) setDupOpen(true);
  };

  const removeRow = (index: number) => {
    setOrders((prev) => prev.filter((_, i) => i !== index));
    toast.success("অর্ডারটি লিস্ট থেকে বাদ দেওয়া হয়েছে");
  };

  const reset = () => {
    setOrders([]); setParseErrors([]); setFileName(null); setResult(null); setPrevQueue([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const doImport = async () => {
    if (!orders.length) return;
    if (dupGroups.length) { setDupOpen(true); toast.error("একই নাম্বারে একাধিক অর্ডার আছে — আগে ঠিক করুন"); return; }
    setBusy(true);
    try {
      const r = await importFn({
        data: {
          orders: orders.map((o) => ({
            order_ref: o.order_ref,
            customer_name: o.customer_name,
            customer_phone: o.customer_phone,
            customer_address: o.customer_address,
            notes: o.notes,
            total: o.total,
            items: o.items,
          })),
        },
      });
      setResult({ imported: r.imported, skipped: r.skipped, errors: r.errors });
      if (r.imported) toast.success(`${r.imported} টি অর্ডার অর্ডার লিস্টে যোগ হয়েছে`);
      if (!r.imported && r.skipped) toast.error("সব অর্ডার আগেই ইমপোর্ট করা ছিল");
      // Show the "this number ordered before" popup at the very end
      const prev = (r.previous ?? []) as PrevOrder[];
      if (prev.length) { setPrevQueue(prev); setPrevIdx(0); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ইমপোর্ট ব্যর্থ");
    } finally {
      setBusy(false);
    }
  };

  const current = prevQueue[prevIdx];

  const nextPrev = () => {
    if (prevIdx + 1 < prevQueue.length) setPrevIdx(prevIdx + 1);
    else setPrevQueue([]);
  };

  const cancelPrev = async () => {
    if (!current) return;
    setCancelBusy(true);
    try {
      await cancelFn({ data: { ids: [current.id] } });
      toast.success("পুরনো অর্ডারটি বাতিল করা হয়েছে");
      nextPrev();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "বাতিল করা যায়নি");
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h1 className="flex items-center gap-2 text-lg font-bold text-brand-dark">
            <FileSpreadsheet className="h-5 w-5" /> ফাইল থেকে অর্ডার
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CSV বা JSON ফাইল আপলোড করুন — এক বা একাধিক অর্ডার প্রোডাক্টসহ সরাসরি <b>অর্ডার লিস্ট</b>-এ চলে যাবে।
          </p>

          <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-brand hover:bg-brand/5">
            <Upload className="h-7 w-7 text-brand" />
            <span className="text-sm font-semibold">ফাইল সিলেক্ট করুন (.csv / .json)</span>
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
            />
          </label>

          {!!orders.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={doImport}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white shadow disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListOrdered className="h-4 w-4" />}
                ফাইল থেকে অর্ডার পরিবর্তন করুন ({orders.length})
              </button>
              {!!dupGroups.length && (
                <button
                  onClick={() => setDupOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
                >
                  <Users className="h-4 w-4" /> ডুপ্লিকেট নাম্বার ({dupGroups.length})
                </button>
              )}
              <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">
                <Trash2 className="h-4 w-4" /> বাতিল
              </button>
            </div>
          )}
        </div>

        {!!parseErrors.length && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="mb-1 flex items-center gap-2 font-bold"><AlertCircle className="h-4 w-4" /> সতর্কতা</div>
            <ul className="list-inside list-disc space-y-0.5">
              {parseErrors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {result && (
          <div className="rounded-xl border bg-card p-3 text-sm shadow-sm">
            <div className="flex items-center gap-2 font-bold text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {result.imported} টি অর্ডার যোগ হয়েছে
            </div>
            {!!result.skipped && <div className="mt-1 text-muted-foreground">{result.skipped} টি আগেই ছিল (স্কিপ)</div>}
            {!!result.errors.length && (
              <ul className="mt-1 list-inside list-disc text-rose-600">
                {result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        {!!orders.length && (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-2">নাম</th>
                  <th className="p-2">ফোন</th>
                  <th className="p-2">প্রোডাক্ট</th>
                  <th className="p-2">ঠিকানা</th>
                  <th className="p-2 text-right">মোট</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="p-2 font-semibold">{o.customer_name}</td>
                    <td className="p-2 whitespace-nowrap">{o.customer_phone}</td>
                    <td className="p-2">
                      {o.items.map((it, j) => (
                        <div key={j}>{it.product_name} × {it.quantity}</div>
                      ))}
                    </td>
                    <td className="p-2 max-w-[220px]">{o.customer_address}</td>
                    <td className="p-2 text-right whitespace-nowrap">{taka(o.total)}</td>
                    <td className="p-2 text-right">
                      <button onClick={() => removeRow(i)} className="rounded p-1 text-rose-600 hover:bg-rose-50" title="ডিলিট">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Popup: same phone number appears multiple times in this file */}
      {dupOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-4 shadow-xl">
            <div className="flex items-center gap-2 text-base font-bold text-amber-700">
              <Users className="h-5 w-5" /> একই নাম্বারে একাধিক অর্ডার
            </div>
            {dupGroups.length ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  নিচের নাম্বারগুলোতে ফাইলে একাধিক অর্ডার আছে। যেটা রাখতে চান না সেটা ডিলিট করুন।
                </p>
                <div className="mt-3 space-y-3">
                  {dupGroups.map(([phone, idxs]) => (
                    <div key={phone} className="rounded-xl border p-2">
                      <div className="mb-1 text-sm font-bold">{phone} — {idxs.length} টি অর্ডার</div>
                      <div className="space-y-1">
                        {idxs.map((i) => (
                          <div key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold">{orders[i].customer_name}</div>
                              <div className="text-muted-foreground">
                                {orders[i].items.map((it) => `${it.product_name} ×${it.quantity}`).join(", ")}
                              </div>
                              <div className="text-muted-foreground">{taka(orders[i].total)}</div>
                            </div>
                            <button
                              onClick={() => removeRow(i)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 font-semibold text-rose-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> ডিলিট
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-green-700">আর কোনো ডুপ্লিকেট নাম্বার নেই।</p>
            )}
            <button
              onClick={() => setDupOpen(false)}
              className="mt-4 w-full rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white"
            >
              ঠিক আছে
            </button>
          </div>
        </div>
      )}

      {/* Popup: this number ordered before — show status, cancel or continue */}
      {current && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-4 shadow-xl">
            <div className="flex items-center gap-2 text-base font-bold text-brand-dark">
              <History className="h-5 w-5" /> আগেও অর্ডার করা হয়েছিল
            </div>
            <p className="mt-2 text-sm">
              <b>{bnDate(current.created_at)}</b> তারিখে <b>{current.customer_name}</b> নামে
              এই নাম্বারে ({current.customer_phone}) অর্ডার করা হয়েছিল।
            </p>
            <div className="mt-3 space-y-1 rounded-xl border bg-slate-50 p-3 text-sm">
              <div>ইনভয়েস: <b>{current.invoice_no ?? "—"}</b></div>
              <div>বর্তমান স্টাটাস: <b className="text-brand-dark">{STATUS_BN[current.status] ?? current.status}</b></div>
              {current.courier_status && <div>কুরিয়ার স্টাটাস: <b>{current.courier_status}</b></div>}
              <div>মোট: <b>{taka(current.total)}</b></div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {prevIdx + 1} / {prevQueue.length}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={cancelPrev}
                disabled={cancelBusy}
                className="flex-1 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-60"
              >
                {cancelBusy ? "বাতিল হচ্ছে..." : "পুরনোটি বাতিল করুন"}
              </button>
              <button
                onClick={nextPrev}
                className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white"
              >
                চালিয়ে যান
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
