import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "../src/routes/admin/orders.tsx");
let source = await readFile(target, "utf8");

const automaticRow = "                  <CourierSuccessCell phone={o.customer_phone} />";
const manualRow = "                  <ManualCourierSuccessCell phone={o.customer_phone} />";
const legacyGuardedRow = `                  <div className="text-[11px] leading-tight text-slate-500">
                    <div className="font-semibold text-slate-700">Fraud check</div>
                    <div>Open order to view courier history</div>
                  </div>`;

const manualComponent = `
type ManualCourierHistoryResult = {
  configured: boolean;
  stats: Array<{ name: string; total: number; success: number; cancelled: number }>;
  error: string | null;
  stale?: boolean;
};

function ManualCourierSuccessCell({ phone }: { phone: string }) {
  const fn = useServerFn(fetchCourierHistory);
  const digits = (phone || "").replace(/\\D/g, "").slice(-11);
  const enabled = digits.length >= 10;
  const [data, setData] = useState<ManualCourierHistoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!enabled || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fn({ data: { phone: digits } });
      setData(result as ManualCourierHistoryResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Courier history check failed");
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return <span className="text-xs text-muted-foreground">—</span>;

  if (!data) {
    return (
      <div className="text-[11px] leading-tight">
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 font-bold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-60"
          title="Cached result থাকলে সেটাই দেখাবে; দরকার হলেই courier API call হবে"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          {loading ? "চেক হচ্ছে..." : "কুরিয়ার চেক"}
        </button>
        {error && <div className="mt-1 max-w-[170px] text-rose-600">{error}</div>}
      </div>
    );
  }

  if (!data.configured) {
    return (
      <div className="text-[11px] leading-tight">
        <div className="text-amber-700">{data.error || "Courier API কানেক্ট নেই"}</div>
        <button type="button" onClick={check} disabled={loading} className="mt-1 font-semibold text-cyan-700 hover:underline">
          {loading ? "চেক হচ্ছে..." : "আবার চেক"}
        </button>
      </div>
    );
  }

  const total = data.stats.reduce((a, s) => a + s.total, 0);
  const success = data.stats.reduce((a, s) => a + s.success, 0);
  const cancelled = data.stats.reduce((a, s) => a + s.cancelled, 0);

  if (!total) {
    return (
      <div className="text-[11px] leading-tight">
        <div className={data.error ? "text-amber-700" : "text-muted-foreground"}>{data.error || "কোনো রেকর্ড নেই"}</div>
        <button type="button" onClick={check} disabled={loading} className="mt-1 font-semibold text-cyan-700 hover:underline">
          {loading ? "চেক হচ্ছে..." : "আবার চেক"}
        </button>
      </div>
    );
  }

  const rate = Math.round((success / total) * 100);
  const ring = rate >= 80 ? "border-emerald-500 text-emerald-700" : rate >= 50 ? "border-amber-500 text-amber-700" : "border-rose-500 text-rose-700";

  return (
    <button type="button" onClick={check} disabled={loading} className="flex items-center gap-2 text-left disabled:opacity-70" title="ক্লিক করলে courier history refresh হবে">
      <div className={\`w-9 h-9 rounded-full border-[3px] \${ring} flex items-center justify-center text-[10px] font-bold\`}>{rate}%</div>
      <div className="text-[11px] leading-tight">
        <div className="text-emerald-700">Success: <b>{rate}%</b></div>
        <div className="text-muted-foreground">Order: <b>{success}/{total}</b></div>
        <div className="text-rose-600">Cancel: <b>{cancelled}</b></div>
        {loading && <div className="text-cyan-700">Refreshing...</div>}
        {!loading && data.stale && <div className="text-amber-600">Cached result</div>}
      </div>
    </button>
  );
}
`;

let changed = false;

if (!source.includes("function ManualCourierSuccessCell")) {
  const anchor = "function CourierSuccessCell({ phone }: { phone: string }) {";
  if (!source.includes(anchor)) {
    throw new Error("CourierSuccessCell component anchor not found; refusing to patch an unknown order-table layout.");
  }
  source = source.replace(anchor, `${manualComponent}\n${anchor}`);
  changed = true;
}

if (source.includes(automaticRow)) {
  source = source.replace(automaticRow, manualRow);
  changed = true;
} else if (source.includes(legacyGuardedRow)) {
  source = source.replace(legacyGuardedRow, manualRow);
  changed = true;
} else if (!source.includes(manualRow)) {
  throw new Error("Courier success-rate row not found; refusing to patch an unknown order-table layout.");
}

if (changed) {
  await writeFile(target, source, "utf8");
  console.log("Applied safe courier UI: success-rate checks are manual per customer and reuse server-side cache.");
} else {
  console.log("Safe courier UI already applied.");
}
