import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Trash2, ListOrdered } from "lucide-react";
import { parseOrdersFile, type ParsedOrder } from "@/lib/order-csv";
import { importOrdersFromFile } from "@/lib/order-import.functions";
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

function OrderImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const importFn = useServerFn(importOrdersFromFile);

  const onFile = async (file: File) => {
    setResult(null);
    const text = await file.text();
    const { orders: parsed, errors } = parseOrdersFile(text, file.name);
    setFileName(file.name);
    setOrders(parsed);
    setParseErrors(errors);
    if (!parsed.length) toast.error("ফাইলে ব্যবহারযোগ্য অর্ডার পাওয়া যায়নি");
    else toast.success(`${parsed.length} টি অর্ডার পড়া হয়েছে`);
  };

  const reset = () => {
    setOrders([]); setParseErrors([]); setFileName(null); setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const doImport = async () => {
    if (!orders.length) return;
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
      setResult(r);
      if (r.imported) toast.success(`${r.imported} টি অর্ডার অর্ডার লিস্টে যোগ হয়েছে`);
      if (!r.imported && r.skipped) toast.error("সব অর্ডার আগেই ইমপোর্ট করা ছিল");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ইমপোর্ট ব্যর্থ");
    } finally {
      setBusy(false);
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
