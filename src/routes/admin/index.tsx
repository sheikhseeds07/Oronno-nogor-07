import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { useAuth } from "@/lib/auth";
import { taka, bnDigits } from "@/lib/format";
import { ShoppingBag, Package, Users, TrendingUp, AlertCircle, Calendar, Award, XCircle, CheckCircle2, Eye } from "lucide-react";
import { LazyFunnelChart } from "@/components/admin/LazyFunnelChart";
import { format } from "date-fns";
import { getSalesReport, getEmployeeReport, getFunnelReport } from "@/lib/reports.functions";
import { getVisitorStats } from "@/lib/visitors.functions";

export const Route = createFileRoute("/admin/")({ component: DashboardGate });

type Preset = "today" | "7d" | "30d" | "month" | "custom";

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function DashboardGate() {
  return <DashboardOrRedirect />;
}

function DashboardOrRedirect() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user && !isAdmin) {
      navigate({ to: "/admin/employees/$userId", params: { userId: user.id }, replace: true });
    }
  }, [loading, user, isAdmin, navigate]);
  if (loading || (user && !isAdmin)) {
    return <AdminLayout><div className="p-8 text-center text-muted-foreground">রিডিরেক্ট হচ্ছে...</div></AdminLayout>;
  }
  return <Dashboard />;
}

function Dashboard() {
  const fetchSales = useServerFn(getSalesReport);
  const fetchEmpReport = useServerFn(getEmployeeReport);
  const fetchFunnel = useServerFn(getFunnelReport);
  const fetchVisitors = useServerFn(getVisitorStats);
  const [preset, setPreset] = useState<Preset>("7d");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [from, setFrom] = useState(format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd"));
  const [to, setTo] = useState(todayStr);

  const range = useMemo(() => {
    const now = new Date();
    if (preset === "today") {
      const f = new Date(); f.setHours(0, 0, 0, 0);
      return { from: f.toISOString(), to: now.toISOString() };
    }
    if (preset === "7d") return { from: new Date(Date.now() - 7 * 86400000).toISOString(), to: now.toISOString() };
    if (preset === "30d") return { from: new Date(Date.now() - 30 * 86400000).toISOString(), to: now.toISOString() };
    if (preset === "month") {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: f.toISOString(), to: now.toISOString() };
    }
    // custom
    const f = new Date(from + "T00:00:00");
    const t = new Date(to + "T23:59:59");
    return { from: f.toISOString(), to: t.toISOString() };
  }, [preset, from, to]);

  const { data: sales } = useQuery({
    queryKey: ["sales-report", range.from, range.to],
    queryFn: () => fetchSales({ data: range }),
    retry: 1,
  });

  const { data: empReport, isError: empReportFailed } = useQuery({
    queryKey: ["emp-report", range.from, range.to],
    queryFn: () => fetchEmpReport({ data: range }),
    retry: 1,
  });

  const { data: funnel } = useQuery({
    queryKey: ["funnel-report", range.from, range.to],
    queryFn: () => fetchFunnel({ data: range }),
    retry: 1,
  });

  const { data: visitors } = useQuery({
    queryKey: ["visitor-stats", range.from, range.to],
    queryFn: () => fetchVisitors({ data: range }),
    retry: 1,
  });

  const { data: meta } = useQuery({
    queryKey: ["admin-meta"],
    queryFn: async () => {
      const [products, customers, lowStock] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("products").select("id,name,stock").lte("stock", 5).eq("is_active", true).limit(5),
      ]);
      return { products: products.count ?? 0, customers: customers.count ?? 0, lowStock: lowStock.data ?? [] };
    },
  });

  const presets: { key: Preset; label: string }[] = [
    { key: "today", label: "আজ" },
    { key: "7d", label: "৭ দিন" },
    { key: "30d", label: "৩০ দিন" },
    { key: "month", label: "এই মাস" },
    { key: "custom", label: "কাস্টম" },
  ];

  const cards = [
    { label: "সাইটে ভিজিটর", value: bnDigits(visitors?.uniqueVisitorsInRange ?? 0), icon: Eye, color: "bg-cyan-600" },
    { label: "মোট ভিজিট (সর্বমোট)", value: bnDigits(visitors?.totalVisitsAllTime ?? 0), icon: Eye, color: "bg-indigo-500" },
    { label: "মোট অর্ডার", value: bnDigits(sales?.totalOrders ?? 0), icon: ShoppingBag, color: "bg-blue-500" },
    { label: "মোট বিক্রয়", value: taka(sales?.revenue ?? 0), icon: TrendingUp, color: "bg-brand" },
    { label: "ডেলিভার্ড বিক্রয়", value: taka(sales?.deliveredRevenue ?? 0), icon: CheckCircle2, color: "bg-emerald-600" },
    { label: "ডেলিভার্ড", value: bnDigits(sales?.delivered ?? 0), icon: Award, color: "bg-green-600" },
    { label: "ক্যান্সেল/রিটার্ন", value: bnDigits(sales?.cancelled ?? 0), icon: XCircle, color: "bg-rose-500" },
    { label: "পেন্ডিং", value: bnDigits(sales?.pending ?? 0), icon: AlertCircle, color: "bg-orange-500" },
    { label: "মোট প্রোডাক্ট", value: bnDigits(meta?.products ?? 0), icon: Package, color: "bg-purple-500" },
    { label: "মোট কাস্টমার", value: bnDigits(meta?.customers ?? 0), icon: Users, color: "bg-pink-500" },
  ];

  const dailySales = asArray(sales?.daily);
  const lowStock = asArray(meta?.lowStock);
  const employeeRows = asArray(empReport);
  const chartData = (dailySales as any[]).map((d) => ({ day: format(new Date(d.date), "dd MMM"), revenue: Number(d.revenue), orders: Number(d.orders) }));
  const funnelData = (asArray(funnel) as any[]).map((d) => ({ ...d, day: format(new Date(d.date), "dd MMM") }));


  return (
    <AdminLayout>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-2xl font-bold">ড্যাশবোর্ড</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${preset === p.key ? "bg-brand text-white border-brand" : "bg-white hover:bg-muted"}`}
            >
              {p.label}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={from} max={todayStr} onChange={(e) => setFrom(e.target.value)} className="border rounded-md px-2 py-1 text-xs" />
              <span className="text-xs">→</span>
              <input type="date" value={to} max={todayStr} onChange={(e) => setTo(e.target.value)} className="border rounded-md px-2 py-1 text-xs" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${c.color} text-white rounded-lg flex items-center justify-center shrink-0`}>
                <c.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground truncate">{c.label}</div>
                <div className="font-bold text-base truncate">{c.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl border p-4">
          <h3 className="font-bold mb-3">দৈনিক বিক্রয়</h3>
          <div className="h-64">
            <LazyFunnelChart data={chartData} bars={[{ key: "revenue", name: "বিক্রয়", color: "oklch(0.52 0.16 145)" }]} />
          </div>

        </div>
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold mb-3">কম স্টক</h3>
          <div className="space-y-2">
            {lowStock.length ? lowStock.map((p) => (
              <div key={p.id} className="flex justify-between text-sm py-2 border-b">
                <span className="truncate">{p.name}</span>
                <span className="text-destructive font-bold">{bnDigits(p.stock)}</span>
              </div>
            )) : <div className="text-sm text-muted-foreground">সবকিছু ভালো আছে ✅</div>}
          </div>
          <Link to="/admin/products" className="mt-3 block text-center text-sm text-brand font-semibold">সব প্রোডাক্ট →</Link>
        </div>
      </div>

      {/* Incomplete vs Web order funnel charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold mb-3">ইনকমপ্লিট ফানেল</h3>
          <div className="h-64">
            <LazyFunnelChart data={funnelData} bars={[
              { key: "totalIncomplete", name: "মোট", color: "#64748b" },
              { key: "converted", name: "অর্ডার হয়েছে", color: "#16a34a" },
              { key: "cancelled", name: "ক্যান্সেল", color: "#ef4444" },
            ]} />
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold mb-3">ওয়েব অর্ডার ফানেল</h3>
          <div className="h-64">
            <LazyFunnelChart data={funnelData} bars={[
              { key: "totalWeb", name: "মোট", color: "#3b82f6" },
              { key: "webProcessed", name: "প্রসেস", color: "#16a34a" },
              { key: "webCancelled", name: "ক্যান্সেল", color: "#ef4444" },
            ]} />
          </div>

        </div>
      </div>


      {/* Employee Report */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><Users className="w-4 h-4" /> কর্মী রিপোর্ট</h3>
          <span className="text-xs text-muted-foreground">এই সময়সীমায়</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="text-left p-2">কর্মী</th>
                <th className="text-right p-2">মোট অর্ডার</th>
                <th className="text-right p-2">কনফার্ম</th>
                <th className="text-right p-2 text-emerald-700">ডেলিভার্ড</th>
                <th className="text-right p-2 text-rose-600">ক্যান্সেল</th>
                <th className="text-right p-2">বিক্রয়</th>
                <th className="text-right p-2">ডেলিভার্ড বিক্রয়</th>
              </tr>
            </thead>
            <tbody>
              {employeeRows.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">{empReportFailed ? "কর্মী রিপোর্ট লোড হয়নি, আবার চেষ্টা করুন" : "এই সময়ে কোনো কর্মীর কাজ নেই"}</td></tr>
              )}
              {(employeeRows as any[]).map((r) => (
                <tr key={r.userId as string} className="border-b">

                  <td className="p-2 font-semibold">
                    <Link to="/admin/employees/$userId" params={{ userId: String(r.userId) }} className="hover:text-brand">{String(r.name)}</Link>
                  </td>
                  <td className="p-2 text-right">{bnDigits(Number(r.total))}</td>
                  <td className="p-2 text-right">{bnDigits(Number(r.confirmed))}</td>
                  <td className="p-2 text-right text-emerald-700 font-semibold">{bnDigits(Number(r.delivered))}</td>
                  <td className="p-2 text-right text-rose-600">{bnDigits(Number(r.cancelled))}</td>
                  <td className="p-2 text-right">{taka(Number(r.revenue))}</td>
                  <td className="p-2 text-right text-emerald-700">{taka(Number(r.deliveredRevenue))}</td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
