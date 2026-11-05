import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Facebook, Loader2, RefreshCw, ShoppingBag, Wallet } from "lucide-react";
import { getMetaAdsDashboard, getOronnoNogorAdsList } from "@/lib/meta-ads-dashboard.functions";
import type { DashboardRange } from "@/components/admin/DashboardTimeFilter";
import { useAuth } from "@/lib/auth";

type Props = { range: DashboardRange; accountKey: "meta_ad_account" | "meta_ad_account_2" | "all"; onAccountChange: (key: "meta_ad_account" | "meta_ad_account_2" | "all") => void };
const money = (value: number, currency: string) => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0); } catch { return `${currency} ${(value || 0).toFixed(2)}`; } };

export function MetaAdsResultCard({ range, accountKey, onAccountChange }: Props) {
  const { permissions, user } = useAuth();
  const fetchAds = useServerFn(getMetaAdsDashboard);
  const fetchOronnoAds = useServerFn(getOronnoNogorAdsList);
  const [adsList, setAdsList] = useState<any>(null);
  const [adsListLoading, setAdsListLoading] = useState(false);
  const [adsListError, setAdsListError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = accountKey === "all"
        ? await (async () => {
            const [first, second] = await Promise.all([
              fetchAds({ data: { ...range, accountKey: "meta_ad_account" } }),
              fetchAds({ data: { ...range, accountKey: "meta_ad_account_2" } }),
            ]);
            if (!first?.connected || !second?.connected) {
              return { connected: false, error: [first?.error, second?.error].filter(Boolean).join(" · ") || "দুইটি Ad Account-ই সংযুক্ত থাকতে হবে", accountOptions: first?.accountOptions || second?.accountOptions || [] };
            }
            if ((first.currency || "USD") !== (second.currency || "USD")) {
              return { connected: false, error: "দুইটি Ad Account-এর currency আলাদা; একসাথে হিসাব দেখানো যাচ্ছে না", accountOptions: first.accountOptions };
            }
            const spend = Number(first.spend || 0) + Number(second.spend || 0);
            const purchases = Number(first.purchases || 0) + Number(second.purchases || 0);
            const spendingLimit = first.spendingLimit == null || second.spendingLimit == null ? null : Number(first.spendingLimit) + Number(second.spendingLimit);
            return { ...first, connected: true, accountName: "All ad account", accountId: null, spend, purchases, costPerPurchase: purchases > 0 ? spend / purchases : 0, spendingLimit, spendingCap: first.spendingCap == null || second.spendingCap == null ? null : Number(first.spendingCap) + Number(second.spendingCap), accountAmountSpent: Number(first.accountAmountSpent || 0) + Number(second.accountAmountSpent || 0), selectedAccountKey: "all", combinedAccounts: true };
          })()
        : await fetchAds({ data: { ...range, accountKey } });
      if (id === requestId.current) setData(result);
    } catch (error) {
      if (id === requestId.current) setData({ connected: false, error: error instanceof Error ? error.message : "Meta Ads data unavailable" });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const loadOronnoAds = async () => {
    setAdsListLoading(true);
    setAdsListError(null);
    try {
      const result = await fetchOronnoAds();
      setAdsList(result);
    } catch (error) {
      setAdsListError(error instanceof Error ? error.message : "বিজ্ঞাপনের তালিকা আনা যায়নি");
    } finally {
      setAdsListLoading(false);
    }
  };

  useEffect(() => {
    requestId.current++;
    if (permissions.dashboard && user?.id) void load();
    else setLoading(false);
    // Auth changes must trigger a fresh request; range changes must never allow an old response to win.
  }, [range.from, range.to, user?.id, permissions.dashboard, accountKey]);

  if (!permissions.dashboard) return null;
  if (loading) return <div className="min-w-0 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"><div className="flex min-h-[176px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div></div>;
  if (!data?.connected) return <div className="min-w-0 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"><div className="flex min-h-[176px] flex-col justify-between"><div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50"><Facebook className="h-5 w-5 text-blue-600" /></div><button onClick={() => void load()} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-slate-700" aria-label="Refresh Meta Ads"><RefreshCw className="h-4 w-4" /></button></div><div><div className="text-[11px] font-bold text-slate-500">Ads Results</div><div className="mt-1 text-sm font-black text-slate-900">Meta Ad Account not connected</div><select value={accountKey} onChange={e => onAccountChange(e.target.value as typeof accountKey)} className="mt-2 max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700"><option value="meta_ad_account">{data.accountOptions?.[0]?.label || "Ad Account 1"}</option><option value="meta_ad_account_2">{data.accountOptions?.[1]?.label || "Ad Account 2"}</option><option value="all">All ad account</option></select><div className="mt-1 text-[10px] text-slate-400">{data.error || "Connect from All API"}</div></div></div></div>;

  const currency = data.currency || "BDT";
  return <div className="group min-w-0 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-2xl"><div className="flex min-h-[176px] flex-col"><div className="flex items-start justify-between gap-2"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50"><Facebook className="h-5 w-5 text-blue-600" /></div><div><div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">Ads Results <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-black text-emerald-600">LIVE</span></div><div className="max-w-[170px] truncate text-[10px] font-semibold text-slate-400">{data.accountName}</div><select aria-label="Select Meta Ad Account" value={accountKey} onChange={e => onAccountChange(e.target.value as typeof accountKey)} className="mt-1 max-w-[170px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold text-slate-600"><option value="meta_ad_account">{data.accountOptions?.[0]?.label || "Ad Account 1"}</option><option value="meta_ad_account_2">{data.accountOptions?.[1]?.label || "Ad Account 2"}</option><option value="all">All ad account</option></select></div></div><button onClick={() => void load()} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-slate-400 transition hover:text-slate-700" aria-label="Refresh Meta Ads"><RefreshCw className="h-3.5 w-3.5" /></button></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-blue-50/70 p-2.5"><div className="flex items-center gap-1 text-[8px] font-bold text-blue-500"><Wallet className="h-3 w-3" /> SPEND</div><div className="mt-0.5 text-base font-black text-slate-900">{money(data.spend, currency)}</div></div><div className="rounded-xl bg-emerald-50/70 p-2.5"><div className="flex items-center gap-1 text-[8px] font-bold text-emerald-600"><ShoppingBag className="h-3 w-3" /> PURCHASES</div><div className="mt-0.5 text-base font-black text-slate-900">{data.purchases}</div></div><div className="rounded-xl bg-violet-50/70 p-2.5"><div className="flex items-center gap-1 text-[8px] font-bold text-violet-600"><BarChart3 className="h-3 w-3" /> COST / RESULT</div><div className="mt-0.5 text-base font-black text-slate-900">{money(data.costPerPurchase, currency)}</div></div><div className="rounded-xl bg-amber-50/70 p-2.5"><div className="text-[8px] font-bold text-amber-600">LIMIT REMAINING</div><div className="mt-0.5 text-base font-black text-slate-900">{data.spendingLimit == null ? "Unlimited" : money(data.spendingLimit, currency)}</div></div></div><div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2"><div className="text-[9px] text-slate-400">{data.since} → {data.until} · {data.combinedAccounts ? "Combined · 2 Ad Accounts" : data.accountId ? "act_" + data.accountId : "Meta Ads"}</div><button onClick={() => void loadOronnoAds()} disabled={adsListLoading} className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 disabled:opacity-60">{adsListLoading ? "Loading ads…" : "Oronno Nogor Ads List"}</button></div>{adsListError && <div className="mt-2 rounded-lg bg-rose-50 p-2 text-[10px] text-rose-700">{adsListError}</div>}{adsList && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-black text-slate-800">{adsList.accountName} · মোট {adsList.total}টি বিজ্ঞাপন</div><div className="flex gap-2 text-[10px] font-bold"><span className="text-emerald-700">On: {adsList.onCount}</span><span className="text-slate-600">Off: {adsList.offCount}</span>{adsList.otherCount > 0 && <span className="text-amber-700">Other: {adsList.otherCount}</span>}</div></div>{adsList.truncated && <div className="mt-1 text-[9px] text-amber-700">Meta pagination limit reached; list may be incomplete.</div>}<div className="mt-2 max-h-72 space-y-1 overflow-y-auto">{adsList.ads.map((ad: any, index: number) => <div key={ad.id || index} className="flex items-start justify-between gap-2 rounded-lg bg-white px-2.5 py-2"><div className="min-w-0"><div className="break-words text-[10px] font-semibold text-slate-800">{index + 1}. {ad.name}</div>{ad.campaignName && <div className="truncate text-[9px] text-slate-400">{ad.campaignName}</div>}</div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${ad.state === "On" ? "bg-emerald-50 text-emerald-700" : ad.state === "Off" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>{ad.state}</span></div>)}{adsList.ads.length === 0 && <div className="py-4 text-center text-[10px] text-slate-400">এই Ad Account-এ কোনো বিজ্ঞাপন পাওয়া যায়নি।</div>}</div><div className="mt-2 text-[9px] text-slate-400">Live Meta status · শুধু দেখা হয়েছে, কোনো বিজ্ঞাপন পরিবর্তন করা হয়নি</div></div>}</div></div>;
}
