import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Trash2, ListOrdered, Users,
} from "lucide-react";
import { parseOrdersFile, type ParsedOrder } from "@/lib/order-csv";
import { deleteImportPreviewOrders, importOrdersFromFile, previewImportOrders } from "@/lib/order-import.functions";
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
  // One unified duplicate popup: existing site orders + new file orders.
  const [prevOrders, setPrevOrders] = useState<PrevOrder[]>([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const importFn = useServerFn(importOrdersFromFile);
  const previewFn = useServerFn(previewImportOrders);
  const deletePreviewFn = useServerFn(deleteImportPreviewOrders);

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
    setPrevOrders([]);
    setDupOpen(false);
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

    setPreviewBusy(true);
    try {
      const preview = await previewFn({
        data: { phones: parsed.map((o) => o.customer_phone) },
      });
      setPrevOrders(preview.previous as PrevOrder[]);
      const fileHasDuplicate = parsed.some((o, i) =>
        parsed.some((other, j) => j > i && normPhone(other.customer_phone) === normPhone(o.customer_phone) && !!normPhone(o.customer_phone)),
      );
      if (preview.previous.length || fileHasDuplicate) setDupOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ডুপ্লিকেট অর্ডার চেক করা যায়নি");
    } finally {
      setPreviewBusy(false);
    }
  };

  const removeRow = (index: number) => {
    setOrders((prev) => prev.filter((_, i) => i !== index));
    toast.success("অর্ডারটি লিস্ট থেকে বাদ দেওয়া হয়েছে");
  };

  const reset = () => {
    setOrders([]); setParseErrors([]); setFileName(null); setResult(null); setPrevOrders([]);
    setDupOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const doImport = async () => {
    if (!orders.length) return;
    if (dupGroups.length) {
      setDupOpen(true);
      toast.error("একই নাম্বারে একাধিক নতুন অর্ডার আছে — প্রয়োজন হলে ডিলিট করুন");
      return;
    }
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
      setDupOpen(false);
      setPrevOrders([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ইমপোর্ট ব্যর্থ");
    } finally {
      setBusy(false);
    }
  };

  const deleteOldOrder = async (id: string) => {
    setDeleteBusyId(id);
    try {
      await deletePreviewFn({ data: { ids: [id] } });
      setPrevOrders((prev) => prev.filter((o) => o.id !== id));
      toast.success("পুরনো অর্ডারটি ডিলিট করা হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "অর্ডার ডিলিট করা যায়নি");
    } finally {
      setDeleteBusyId(null);
    }
  };

  const currentDuplicateGroups = (() => {
    const phoneSet = new Set<string>();
    for (const o of orders) {
      const phone = normPhone(o.customer_phone);
      if (phone) phoneSet.add(phone);
    }
    for (const o of prevOrders) {
      const phone = normPhone(o.customer_phone);
      if (phone) phoneSet.add(phone);
    }
    return [...phoneSet].map((phone) => {
      const newIndexes = orders
        .map((o, i) => ({ phone: normPhone(o.customer_phone), i }))
        .filter((x) => x.phone === phone)
        .map((x) => x.i);
      const oldOrders = prevOrders.filter((o) => normPhone(o.customer_phone) === phone);
      return { phone, newIndexes, oldOrders };
    }).filter((g) => g.oldOrders.length > 0 || g.newIndexes.length > 1);
  })();


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

      {/* One popup: old site orders + new file orders for every duplicate phone */}
      {dupOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-card p-4 shadow-xl">
            <div className="flex items-center gap-2 text-base font-bold text-amber-700">
              <Users className="h-5 w-5" /> ডুপ্লিকেট অর্ডার পাওয়া গেছে
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              একই নাম্বারের পুরনো অর্ডার এবং এই ফাইলের নতুন অর্ডার একসাথে দেখানো হয়েছে। যেটা রাখতে চান না, পাশের ডিলিট আইকনে চাপুন।
            </p>

            <div className="mt-4 space-y-4">
              {currentDuplicateGroups.map((group) => (
                <div key={group.phone} className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-bold">{group.phone}</div>
                    <div className="text-xs text-muted-foreground">
                      পুরনো {group.oldOrders.length} + নতুন {group.newIndexes.length}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border bg-slate-50 p-2">
                      <div className="mb-2 text-xs font-bold text-slate-600">পুরনো অর্ডার</div>
                      {group.oldOrders.length ? group.oldOrders.map((old) => (
                        <div key={old.id} className="mb-2 flex items-start gap-2 rounded-lg bg-white p-2 text-xs last:mb-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold">{old.customer_name}</div>
                            <div className="text-muted-foreground">ইনভয়েস: {old.invoice_no ?? "—"} · {STATUS_BN[old.status] ?? old.status}</div>
                            <div className="text-muted-foreground">{bnDate(old.created_at)} · {taka(old.total)}</div>
                          </div>
                          <button
                            onClick={() => void deleteOldOrder(old.id)}
                            disabled={deleteBusyId === old.id}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            title="ডিলিট"
                          >
                            {deleteBusyId === old.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      )) : (
                        <div className="p-2 text-xs text-muted-foreground">কোনো পুরনো অর্ডার নেই</div>
                      )}
                    </div>

                    <div className="rounded-xl border bg-emerald-50/40 p-2">
                      <div className="mb-2 text-xs font-bold text-emerald-700">নতুন অর্ডার — ফাইল থেকে</div>
                      {group.newIndexes.map((i) => (
                        <div key={i} className="mb-2 flex items-start gap-2 rounded-lg bg-white p-2 text-xs last:mb-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold">{orders[i].customer_name}</div>
                            <div className="text-muted-foreground">
                              {orders[i].items.map((it) => `${it.product_name} ×${it.quantity}`).join(", ")}
                            </div>
                            <div className="text-muted-foreground">{taka(orders[i].total)}</div>
                          </div>
                          <button
                            onClick={() => removeRow(i)}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                            title="ডিলিট"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {siteOnlyOldOrders.map((old) => (
                <div key={old.id} className="rounded-xl border p-3">
                  <div className="mb-2 font-bold">{old.customer_phone}</div>
                  <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{old.customer_name}</div>
                      <div className="text-muted-foreground">ইনভয়েস: {old.invoice_no ?? "—"} · {STATUS_BN[old.status] ?? old.status}</div>
                      <div className="text-muted-foreground">{bnDate(old.created_at)} · {taka(old.total)}</div>
                    </div>
                    <button
                      onClick={() => void deleteOldOrder(old.id)}
                      disabled={deleteBusyId === old.id}
                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      title="ডিলিট"
                    >
                      {deleteBusyId === old.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDupOpen(false)}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-bold"
              >
                বন্ধ
              </button>
              <button
                onClick={() => void doImport()}
                disabled={busy || previewBusy || !orders.length || !!dupGroups.length}
                className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "ইমপোর্ট হচ্ছে..." : "ঠিক আছে — Import চালিয়ে যান"}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
