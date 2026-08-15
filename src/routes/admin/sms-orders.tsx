import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { RefreshCw, Radio, Search, Phone, MapPin, ShoppingBag, Clock3, Wifi, WifiOff } from "lucide-react";
import { BrandLoader } from "@/components/layout/BrandLoader";

export const Route = createFileRoute("/admin/sms-orders")({ component: SmsOrders });

type Order = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  total: number | null;
  status: string | null;
  created_at: string | null;
  notes: string | null;
};

function SmsOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setSyncing(true);
    const { data } = await supabase
      .from("orders")
      .select("id,customer_name,customer_phone,customer_address,total,status,created_at,notes")
      .eq("source", "presswayy-ai")
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders((data ?? []) as Order[]);
    setLoading(false);
    setSyncing(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("presswayy-live-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: "source=eq.presswayy-ai" }, (payload) => {
        setOrders((current) => {
          if (payload.eventType === "INSERT") return [payload.new as Order, ...current.filter((o) => o.id !== payload.new.id)].slice(0, 200);
          if (payload.eventType === "UPDATE") return current.map((o) => o.id === payload.new.id ? payload.new as Order : o);
          if (payload.eventType === "DELETE") return current.filter((o) => o.id !== payload.old.id);
          return current;
        });
      })
      .subscribe((status) => setOnline(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => [o.customer_name, o.customer_phone, o.customer_address, o.id].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [orders, search]);

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><BrandLoader /></div>;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-violet-50/70 p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-100 p-3"><Radio className="h-6 w-6 text-violet-600" /></div>
            <div><h1 className="text-xl font-extrabold text-slate-900">SMS অর্ডার</h1><p className="text-sm text-slate-500">Presswayy AI থেকে আসা অর্ডার — লাইভ সিংক</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-bold">
            {online ? <><Wifi className="h-4 w-4 text-emerald-600" /> লাইভ কানেক্টেড</> : <><WifiOff className="h-4 w-4 text-slate-400" /> কানেকশন অপেক্ষমাণ</>}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, ফোন বা অর্ডার ID খুঁজুন..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></div>
          <button onClick={load} disabled={syncing} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:shadow-md disabled:opacity-50"><RefreshCw className={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> রিফ্রেশ</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<ShoppingBag className="h-4 w-4" />} label="মোট Presswayy অর্ডার" value={orders.length} />
        <Stat icon={<Radio className="h-4 w-4" />} label="বর্তমানে দেখাচ্ছে" value={filtered.length} />
        <Stat icon={<Wifi className="h-4 w-4" />} label="লাইভ স্ট্যাটাস" value={online ? "চালু" : "অপেক্ষমাণ"} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">এখনও কোনো Presswayy অর্ডার পাওয়া যায়নি।</div> : <div className="divide-y">
          {filtered.map((order) => <div key={order.id} className="p-4 transition hover:bg-slate-50 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><div className="font-bold text-slate-900">{order.customer_name || "কাস্টমার"}</div><div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{order.customer_phone || "—"}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{order.customer_address || "—"}</span></div></div>
              <div className="text-right"><div className="font-extrabold text-brand">৳{Number(order.total ?? 0).toLocaleString()}</div><div className="mt-1 text-[11px] text-slate-400">#{String(order.id).slice(0, 8)}</div></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]"><span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">Presswayy AI</span><span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{order.status || "web_pending"}</span><span className="inline-flex items-center gap-1 text-slate-400"><Clock3 className="h-3 w-3" />{order.created_at ? new Date(order.created_at).toLocaleString("bn-BD") : "—"}</span></div>
          </div>)}
        </div>}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500">{icon}{label}</div><div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div></div>; }
