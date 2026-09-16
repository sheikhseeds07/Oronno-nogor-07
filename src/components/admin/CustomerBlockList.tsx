import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Loader2, Search, ShieldAlert, Unlock, X } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";
import { normalizeBdPhone } from "@/lib/bd-phone";
import { toast } from "sonner";

type BlockRow = {
  id: string;
  customer_name: string;
  phone: string | null;
  ip_address: string | null;
  is_active: boolean;
  blocked_at: string;
  unblocked_at: string | null;
  blocked_by?: string | null;
};

function ConfirmModal({ title, tone, children, confirmLabel, busy, onConfirm, onClose }: {
  title: string; tone: "danger" | "safe"; children: React.ReactNode; confirmLabel: string;
  busy: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const danger = tone === "danger";
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm animate-in fade-in zoom-in-95 rounded-2xl border bg-white p-5 shadow-2xl duration-200" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${danger ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{danger ? <Ban className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}</span>
            <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2 text-sm text-slate-600">{children}</div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">বাতিল</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-extrabold text-white transition disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BlockCustomerButton({ name, phone, orderId }: { name: string; phone?: string | null; orderId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ip, setIp] = useState<string | null>(null);
  const [loadingIp, setLoadingIp] = useState(false);
  const [orderPhone, setOrderPhone] = useState<string | null>(null);
  const blockPhone = normalizeBdPhone(phone || "") || orderPhone;

  const openModal = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    setOpen(true);
    setLoadingIp(true);
    void (async () => {
      try {
        const { data: order, error } = await supabase.from("orders").select("client_ip,customer_phone").eq("id", orderId).maybeSingle();
        if (error) throw error;
        const row = order as { client_ip?: string | null; customer_phone?: string | null } | null;
        setIp(row?.client_ip ?? null);
        setOrderPhone(normalizeBdPhone(row?.customer_phone || "") || null);
      } catch (error) {
        console.error("[BlockCustomerButton] failed to load customer info", error);
        setIp(null);
        toast.error("Customer তথ্য লোড করা যায়নি");
      } finally {
        setLoadingIp(false);
      }
    })();
  };

  const confirm = async () => {
    const finalPhone = blockPhone || normalizeBdPhone(phone || "") || null;
    if (!finalPhone && !ip) {
      toast.error("Customer-এর mobile number বা IP পাওয়া যায়নি");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("block_customer", { p_phone: finalPhone, p_ip: ip, p_name: name } as never);
      if (error) throw error;
      setOpen(false);
      const row = Array.isArray(data) ? (data[0] as BlockRow | undefined) : (data as BlockRow | undefined);
      toast.success(row?.is_active === false ? "Customer আবার block করা হয়েছে" : `Block করা হয়েছে: ${name}`);
      await qc.invalidateQueries({ queryKey: ["customer-blocklist"] });
    } catch (error: any) {
      console.error("[BlockCustomerButton] block failed", error);
      toast.error(error?.message || "Customer block করা যায়নি");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={openModal} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-red-700 hover:shadow-md active:scale-[.98] cursor-pointer">
        <Ban className="h-3.5 w-3.5" /> Block Now
      </button>
      {open && (
        <ConfirmModal title="Customer Block করবেন?" tone="danger" confirmLabel="Block Customer" busy={busy} onConfirm={confirm} onClose={() => !busy && setOpen(false)}>
          <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 space-y-1.5">
            <div className="flex justify-between gap-3"><span className="text-xs font-semibold text-slate-500">Customer Name</span><span className="truncate text-xs font-bold text-slate-900">{name}</span></div>
            <div className="flex justify-between gap-3"><span className="text-xs font-semibold text-slate-500">Mobile Number</span><span className="font-mono text-xs font-bold text-slate-900">{loadingIp ? "…" : blockPhone || "Not available"}</span></div>
            <div className="flex justify-between gap-3"><span className="text-xs font-semibold text-slate-500">IP Address</span><span className="font-mono text-xs font-bold text-slate-900">{loadingIp ? "…" : ip || "Not available"}</span></div>
          </div>
          <p className="text-xs text-slate-500">Mobile Number এবং IP — দুই দিক থেকেই block হবে। এরপর এই customer সাইটে ঢুকতে বা অর্ডার করতে পারবে না।</p>
        </ConfirmModal>
      )}
    </>
  );
}

export function CustomerBlockListPanel() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<BlockRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["customer-blocklist"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_customer_blocks");
      if (error) throw new Error(error.message);
      return (data ?? []) as BlockRow[];
    },
  });

  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    const normalizedTerm = normalizeBdPhone(term);
    return (data ?? []).filter((row) => {
      const phone = row.phone || "";
      const ip = row.ip_address || "";
      const name = row.customer_name || "";
      return phone.toLowerCase().includes(term) ||
        ip.toLowerCase().includes(term) ||
        name.toLowerCase().includes(term) ||
        (!!normalizedTerm && normalizeBdPhone(phone).includes(normalizedTerm));
    });
  }, [data, search]);

  const confirmUnblock = async () => {
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.rpc("unblock_customer", { p_id: target.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTarget(null);
    toast.success("Customer unblock করা হয়েছে");
    qc.invalidateQueries({ queryKey: ["customer-blocklist"] });
  };

  return (
    <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/60 p-4"><div className="rounded-xl bg-red-100 p-2.5 text-red-700"><ShieldAlert className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="font-extrabold text-slate-900">Blocked Customers</h2><p className="mt-0.5 text-xs text-slate-500">Mobile Number + IP অনুযায়ী block করা তালিকা। শুধু Admin এখান থেকে unblock করতে পারবে।</p></div></div>
      {!isLoading && !isError && (data?.length ?? 0) > 0 && <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="মোবাইল নাম্বার বা IP দিয়ে খুঁজুন..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100" aria-label="Blocked customer mobile number or IP search" />{search && <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600" aria-label="Clear search"><X className="h-4 w-4" /></button>}</div>}
      {search && !isLoading && !isError && <div className="text-xs font-semibold text-slate-500">{filteredData.length}টি ফলাফল পাওয়া গেছে</div>}
      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
      {isError && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Block list load করা যায়নি।</div>}
      {!isLoading && !isError && (data?.length ?? 0) === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">এখনও কোনো customer block করা হয়নি।</div>}
      {!isLoading && !isError && (data?.length ?? 0) > 0 && filteredData.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">এই নাম্বার বা IP-এর সাথে কোনো block পাওয়া যায়নি।</div>}
      <div className="space-y-2">{filteredData.map((row) => <div key={row.id} className={`flex flex-col gap-3 rounded-xl border p-3 transition sm:flex-row sm:items-center ${row.is_active ? "border-red-100 bg-red-50/30 hover:bg-red-50/60" : "border-slate-200 bg-slate-50/50 opacity-75"}`}><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-bold text-slate-900">{row.customer_name}</span>{row.is_active ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">BLOCKED</span> : <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-600">UNBLOCKED</span>}</div><div className="mt-1 text-[11px] text-slate-500">Phone: <span className="font-mono">{row.phone || "N/A"}</span> · IP: <span className="font-mono">{row.ip_address || "Not available"}</span> · Block Date: {new Date(row.blocked_at).toLocaleString("en-BD")}</div><div className="text-[11px] text-slate-500">Blocked By: <span className="font-semibold text-slate-600">{row.blocked_by || "Admin"}</span></div></div>{row.is_active ? <button type="button" onClick={() => setTarget(row)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 active:scale-[.98]"><Unlock className="h-3.5 w-3.5" /> Unblock</button> : <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-400"><CheckCircle2 className="h-3.5 w-3.5" /> Unblocked</span>}</div>)}</div>
      {target && <ConfirmModal title="Customer Unblock করবেন?" tone="safe" confirmLabel="Unblock" busy={busy} onConfirm={confirmUnblock} onClose={() => !busy && setTarget(null)}><div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 space-y-1.5"><div className="flex justify-between gap-3"><span className="text-xs font-semibold text-slate-500">Customer Name</span><span className="truncate text-xs font-bold text-slate-900">{target.customer_name}</span></div><div className="flex justify-between gap-3"><span className="text-xs font-semibold text-slate-500">IP Address</span><span className="font-mono text-xs font-bold text-slate-900">{target.ip_address || "Not available"}</span></div><div className="flex justify-between gap-3"><span className="text-xs font-semibold text-slate-500">Mobile Number</span><span className="font-mono text-xs font-bold text-slate-900">{target.phone || "Not available"}</span></div></div><p className="text-xs text-slate-500">Unblock করলে এই customer আবার অর্ডার করতে পারবে।</p></ConfirmModal>}
    </div>
  );
}
