import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { format } from "date-fns";
import { Search, UserRound, Phone, MapPin, CalendarDays, ShieldCheck, ShieldOff, Eye, Pencil, X, ShoppingBag, Ban, CheckCircle2, Loader2 } from "lucide-react";
import { listCustomersAdmin, setCustomerBlocked, updateCustomerAdmin } from "@/lib/customer-admin.functions";

export const Route = createFileRoute("/admin/customers")({ component: Customers });

type Customer = {
  id: string; phone: string | null; full_name: string | null; avatar_url: string | null;
  address: string | null; district: string | null; thana: string | null;
  created_at: string; updated_at: string; is_blocked: boolean; blocked_at: string | null; blocked_reason: string | null;
};

function Customers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", address: "", district: "", thana: "" });
  const [blockReason, setBlockReason] = useState("");

  const customers = useQuery({ queryKey: ["admin-customers-v2"], queryFn: async () => (await listCustomersAdmin()) as Customer[] });
  const blockMutation = useMutation({
    mutationFn: (v: { id: string; blocked: boolean; reason?: string }) => setCustomerBlocked(v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customers-v2"] }); setSelected(null); },
  });
  const updateMutation = useMutation({
    mutationFn: (v: any) => updateCustomerAdmin(v),
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["admin-customers-v2"] }); setSelected(row as Customer); setEditing(false); },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (customers.data ?? []).filter((c) => {
      const hay = `${c.full_name ?? ""} ${c.phone ?? ""} ${c.address ?? ""} ${c.district ?? ""}`.toLowerCase();
      return (!q || hay.includes(q)) && (status === "all" || (status === "blocked" ? c.is_blocked : !c.is_blocked));
    });
  }, [customers.data, search, status]);

  const activeCount = (customers.data ?? []).filter((c) => !c.is_blocked).length;
  const blockedCount = (customers.data ?? []).filter((c) => c.is_blocked).length;

  const openProfile = (c: Customer) => {
    setSelected(c); setEditing(false); setBlockReason(c.blocked_reason ?? "");
    setForm({ full_name: c.full_name ?? "", phone: c.phone ?? "", address: c.address ?? "", district: c.district ?? "", thana: c.thana ?? "" });
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><UserRound className="h-4 w-4" /> Customer Management</div>
            <h1 className="text-3xl font-bold tracking-tight">কাস্টমার</h1>
            <p className="text-sm text-muted-foreground mt-1">শুধু কাস্টমার অ্যাকাউন্ট — প্রোফাইল দেখুন, তথ্য নিয়ন্ত্রণ করুন ও প্রয়োজন হলে ব্লক করুন।</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Stat label="মোট কাস্টমার" value={customers.data?.length ?? 0} />
            <Stat label="সক্রিয়" value={activeCount} good />
            <Stat label="ব্লকড" value={blockedCount} danger />
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, ফোন, ঠিকানা দিয়ে খুঁজুন..." className="h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex rounded-xl border bg-background p-1 w-fit">
              {([['all', 'সব'], ['active', 'সক্রিয়'], ['blocked', 'ব্লকড']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setStatus(key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${status === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30 text-muted-foreground"><th className="text-left p-4 font-semibold">কাস্টমার</th><th className="text-left p-4 font-semibold">যোগাযোগ</th><th className="text-left p-4 font-semibold">লোকেশন</th><th className="text-left p-4 font-semibold">স্ট্যাটাস</th><th className="text-right p-4 font-semibold">অ্যাকশন</th></tr></thead>
              <tbody>
                {customers.isLoading ? <tr><td colSpan={5} className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td></tr> : rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-4"><div className="flex items-center gap-3 min-w-[220px]"><Avatar customer={c} /><div><div className="font-semibold">{c.full_name || 'নাম দেওয়া হয়নি'}</div><div className="text-xs text-muted-foreground mt-0.5">ID: {c.id.slice(0, 8)}…</div></div></div></td>
                    <td className="p-4"><div className="font-medium">{c.phone || '—'}</div></td>
                    <td className="p-4 max-w-[260px]"><div className="truncate">{c.address || 'ঠিকানা নেই'}</div><div className="text-xs text-muted-foreground">{[c.thana, c.district].filter(Boolean).join(', ') || '—'}</div></td>
                    <td className="p-4"><Status blocked={c.is_blocked} /></td>
                    <td className="p-4"><div className="flex justify-end gap-2"><button onClick={() => openProfile(c)} className="h-9 px-3 rounded-lg border bg-background hover:bg-muted flex items-center gap-1.5 text-xs font-semibold"><Eye className="h-4 w-4" /> প্রোফাইল</button><button onClick={() => { openProfile(c); setEditing(true); }} className="h-9 w-9 rounded-lg border bg-background hover:bg-muted flex items-center justify-center"><Pencil className="h-4 w-4" /></button></div></td>
                  </tr>
                ))}
                {!customers.isLoading && !rows.length && <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">কোনো কাস্টমার পাওয়া যায়নি</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && <CustomerDrawer customer={selected} editing={editing} setEditing={setEditing} form={form} setForm={setForm} blockReason={blockReason} setBlockReason={setBlockReason} onClose={() => setSelected(null)} onSave={() => updateMutation.mutate({ id: selected.id, ...form })} saving={updateMutation.isPending} onBlock={() => blockMutation.mutate({ id: selected.id, blocked: !selected.is_blocked, reason: blockReason })} blocking={blockMutation.isPending} />}
    </AdminLayout>
  );
}

function Stat({ label, value, good, danger }: { label: string; value: number; good?: boolean; danger?: boolean }) { return <div className="rounded-xl border bg-card px-4 py-3 min-w-[110px]"><div className="text-2xl font-bold">{value}</div><div className={`text-xs font-medium ${good ? 'text-emerald-600' : danger ? 'text-red-600' : 'text-muted-foreground'}`}>{label}</div></div>; }
function Avatar({ customer }: { customer: Customer }) { return customer.avatar_url ? <img src={customer.avatar_url} className="h-10 w-10 rounded-full object-cover border" /> : <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{(customer.full_name || 'ক').trim().charAt(0).toUpperCase()}</div>; }
function Status({ blocked }: { blocked: boolean }) { return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${blocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{blocked ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}{blocked ? 'ব্লকড' : 'সক্রিয়'}</span>; }

function CustomerDrawer({ customer, editing, setEditing, form, setForm, blockReason, setBlockReason, onClose, onSave, saving, onBlock, blocking }: any) {
  const [orders, setOrders] = useState<any[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const loadOrders = async () => { if (!customer.phone) return; setOrdersLoading(true); const { data } = await supabase.from('orders').select('id,invoice_no,status,total,created_at').eq('customer_phone', customer.phone).order('created_at', { ascending: false }).limit(8); setOrders(data ?? []); setOrdersLoading(false); };
  return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex justify-end" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><aside className="h-full w-full max-w-xl bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
    <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur p-4 flex items-center justify-between"><div className="flex items-center gap-3"><Avatar customer={customer} /><div><h2 className="font-bold text-lg">{customer.full_name || 'কাস্টমার প্রোফাইল'}</h2><Status blocked={customer.is_blocked} /></div></div><button onClick={onClose} className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center"><X className="h-5 w-5" /></button></div>
    <div className="p-5 space-y-5">
      <section className="rounded-2xl border p-4"><div className="flex items-center justify-between mb-4"><h3 className="font-bold">প্রোফাইল তথ্য</h3>{!editing && <button onClick={() => setEditing(true)} className="text-primary text-sm font-semibold flex items-center gap-1"><Pencil className="h-4 w-4" /> এডিট</button>}</div>
        {editing ? <div className="space-y-3">{[['full_name','নাম'],['phone','ফোন'],['address','ঠিকানা'],['district','জেলা'],['thana','থানা']].map(([key,label]) => <label key={key} className="block text-sm font-medium">{label}<input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 h-10 w-full rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-primary/20" /></label>)}<div className="flex gap-2 pt-2"><button onClick={() => setEditing(false)} className="flex-1 h-10 rounded-lg border">বাতিল</button><button disabled={saving} onClick={onSave} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />} সংরক্ষণ</button></div></div> : <div className="grid gap-4 sm:grid-cols-2"><Info icon={Phone} label="ফোন" value={customer.phone} /><Info icon={CalendarDays} label="যোগ দিয়েছেন" value={customer.created_at ? format(new Date(customer.created_at), 'dd MMM yyyy, hh:mm a') : '—'} /><Info icon={MapPin} label="ঠিকানা" value={customer.address} wide /><Info icon={MapPin} label="জেলা / থানা" value={[customer.district, customer.thana].filter(Boolean).join(' / ')} wide /></div>}
      </section>

      <section className="rounded-2xl border p-4"><div className="flex items-center justify-between"><div><h3 className="font-bold">অর্ডার ইতিহাস</h3><p className="text-xs text-muted-foreground mt-1">এই কাস্টমারের সাম্প্রতিক অর্ডার</p></div><button onClick={loadOrders} className="h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5"><ShoppingBag className="h-4 w-4" /> দেখুন</button></div>{ordersLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-6" /> : orders ? <div className="mt-4 space-y-2">{orders.map((o) => <div key={o.id} className="rounded-xl bg-muted/40 p-3 flex items-center justify-between"><div><div className="font-semibold text-sm">#{o.invoice_no || o.id.slice(0,8)}</div><div className="text-xs text-muted-foreground">{o.created_at ? format(new Date(o.created_at), 'dd MMM yyyy') : '—'} · {o.status || '—'}</div></div><div className="font-bold">৳{Number(o.total || 0).toLocaleString('bn-BD')}</div></div>)}{!orders.length && <div className="py-6 text-center text-sm text-muted-foreground">কোনো অর্ডার নেই</div>}</div> : null}</section>

      <section className={`rounded-2xl border p-4 ${customer.is_blocked ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/40'}`}><div className="flex items-start gap-3">{customer.is_blocked ? <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" /> : <Ban className="h-5 w-5 text-red-600 mt-0.5" />}<div className="flex-1"><h3 className="font-bold">{customer.is_blocked ? 'কাস্টমার ব্লক করা আছে' : 'কাস্টমার অ্যাক্সেস কন্ট্রোল'}</h3><p className="text-xs text-muted-foreground mt-1">{customer.is_blocked ? `ব্লক করা হয়েছে ${customer.blocked_at ? format(new Date(customer.blocked_at), 'dd MMM yyyy, hh:mm a') : ''}.` : 'ব্লক করলে কাস্টমার নতুন OTP দিয়ে লগইন করতে পারবে না।'}</p>{!customer.is_blocked && <textarea value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="ব্লকের কারণ (ঐচ্ছিক)" rows={2} className="mt-3 w-full rounded-lg border bg-background p-3 text-sm" />}<button disabled={blocking} onClick={onBlock} className={`mt-3 h-10 px-4 rounded-lg font-semibold text-sm flex items-center gap-2 ${customer.is_blocked ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{blocking && <Loader2 className="h-4 w-4 animate-spin" />}{customer.is_blocked ? 'Unblock Customer' : 'Block Customer'}</button>{customer.is_blocked && customer.blocked_reason && <p className="text-xs mt-2 text-muted-foreground">কারণ: {customer.blocked_reason}</p>}</div></div></section>
    </div>
  </aside></div>;
}

function Info({ icon: Icon, label, value, wide }: any) { return <div className={wide ? 'sm:col-span-2' : ''}><div className="text-xs text-muted-foreground flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</div><div className="text-sm font-medium mt-1">{value || '—'}</div></div>; }
