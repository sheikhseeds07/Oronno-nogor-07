import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardPath = path.resolve(here, "../src/components/admin/PremiumDashboard.tsx");
const optimizedPath = path.resolve(here, "../src/lib/dashboard-optimized.functions.ts");

let dashboard = await readFile(dashboardPath, "utf8");
let optimized = await readFile(optimizedPath, "utf8");
let dashboardChanged = false;
let optimizedChanged = false;

function replaceDashboard(from, to, label) {
  if (dashboard.includes(to)) return;
  if (!dashboard.includes(from)) {
    console.warn(`Dashboard patch skipped (${label}): pattern not found.`);
    return;
  }
  dashboard = dashboard.replace(from, to);
  dashboardChanged = true;
  console.log(`Applied dashboard patch: ${label}`);
}

function replaceOptimized(from, to, label) {
  if (optimized.includes(to)) return;
  if (!optimized.includes(from)) {
    console.warn(`Optimized dashboard patch skipped (${label}): pattern not found.`);
    return;
  }
  optimized = optimized.replace(from, to);
  optimizedChanged = true;
  console.log(`Applied optimized dashboard patch: ${label}`);
}

// Preserve the user's selected dashboard time range across refreshes/deploys.
replaceDashboard(
  'const [refreshing,setRefreshing]=useState(false);const {data,isFetching,refetch}=useQuery(',
  'const [refreshing,setRefreshing]=useState(false);useEffect(()=>{try{const raw=window.localStorage.getItem("business-dashboard-filter-v1");if(!raw)return;const saved=JSON.parse(raw);if(saved?.preset&&saved?.range?.from&&saved?.range?.to){setPreset(saved.preset);setRange(saved.range)}}catch{}},[]);const {data,isFetching,refetch}=useQuery(',
  "restore saved time filter after refresh",
);

replaceDashboard(
  'const onFilterChange=(next:DashboardPreset,nextRange:DashboardRange|null)=>{if(!nextRange)return;setPreset(next);setRange(nextRange)};',
  'const onFilterChange=(next:DashboardPreset,nextRange:DashboardRange|null)=>{if(!nextRange)return;setPreset(next);setRange(nextRange);try{window.localStorage.setItem("business-dashboard-filter-v1",JSON.stringify({preset:next,range:nextRange}))}catch{}};',
  "save selected time filter",
);

// Restore Meta Ads + courier + cancellation settings that were accidentally zeroed
// when the dashboard was moved to the DB-aggregated low-egress report.
const helper = `\ntype MetaProfitConfig={access_token?:string;ad_account_id?:string;account_name?:string;dollar_rate?:number;courier_cost_per_order?:number;return_rate?:number;cancel_rate?:number};\n\nasync function getMetaProfitData(db:any,from:string,to:string){\n  const defaults={dollarRate:122,courierCostPerOrder:50,cancelRate:20,adSpendUsd:0,adSpendBdt:0,connected:false,accountName:\"\"};\n  const {data:integration,error}=await db.from(\"integrations\").select(\"config,is_active\").eq(\"name\",\"meta_ad_account\").maybeSingle();\n  if(error)throw new Error(error.message);\n  const raw=(integration?.config??{}) as MetaProfitConfig;\n  const dollarRate=Math.max(0,Number(raw.dollar_rate)||defaults.dollarRate);\n  const courierCostPerOrder=Math.max(0,Number(raw.courier_cost_per_order)||defaults.courierCostPerOrder);\n  const cancelRate=Math.min(100,Math.max(0,Number(raw.cancel_rate??raw.return_rate)||defaults.cancelRate));\n  if(!integration?.is_active||!raw.access_token||!raw.ad_account_id)return {...defaults,dollarRate,courierCostPerOrder,cancelRate};\n  try{\n    const accountId=raw.ad_account_id.replace(/^act_/,\"\");\n    const since=new Intl.DateTimeFormat(\"en-CA\",{timeZone:\"Asia/Dhaka\"}).format(new Date(from));\n    const until=new Intl.DateTimeFormat(\"en-CA\",{timeZone:\"Asia/Dhaka\"}).format(new Date(to));\n    const timeRange=encodeURIComponent(JSON.stringify({since,until}));\n    const url=\`https://graph.facebook.com/v23.0/act_\${encodeURIComponent(accountId)}/insights?fields=spend&time_range=\${timeRange}&level=account&access_token=\${encodeURIComponent(raw.access_token.trim())}\`;\n    const response=await fetch(url);\n    const json=await response.json();\n    if(!response.ok||json?.error)throw new Error(json?.error?.message||\"Meta spend request failed\");\n    const adSpendUsd=Number(json?.data?.[0]?.spend||0);\n    return {dollarRate,courierCostPerOrder,cancelRate,adSpendUsd,adSpendBdt:adSpendUsd*dollarRate,connected:true,accountName:raw.account_name||\"Meta Ad Account\"};\n  }catch{return {dollarRate,courierCostPerOrder,cancelRate,adSpendUsd:0,adSpendBdt:0,connected:true,accountName:raw.account_name||\"Meta Ad Account\",error:\"Meta spend unavailable\"};}\n}\n`;

replaceOptimized(
  'const empty = { total: 0, confirmed: 0, processing: 0, cancelled: 0 };\n',
  'const empty = { total: 0, confirmed: 0, processing: 0, cancelled: 0 };\n' + helper,
  "restore profit settings + Meta spend loader",
);

replaceOptimized(
  '    const confirmedOrders = Number(real.approved ?? real.confirmed ?? 0);\n\n    return {',
  '    const confirmedOrders = Number(real.approved ?? real.confirmed ?? 0);\n    const profitSettings = await getMetaProfitData(supabaseAdmin as any, data.from, data.to);\n    const courierCost = confirmedOrders * profitSettings.courierCostPerOrder;\n    const cancellationAdjustment = grossSales * (profitSettings.cancelRate / 100);\n    const netProfit = grossSales - productCost - profitSettings.adSpendBdt - courierCost - cancellationAdjustment;\n    const netProfitMargin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;\n\n    return {',
  "calculate real profit from configured costs",
);

replaceOptimized(
  '      profit: { grossSales, productCost, adSpendUsd: 0, adSpendBdt: 0, dollarRate: 122, confirmedOrders, courierCost: 0, courierCostPerOrder: 50, cancelRate: 20, cancellationAdjustment: 0, netProfit: grossSales - productCost, netProfitMargin: grossSales > 0 ? ((grossSales - productCost) / grossSales) * 100 : 0, connected: false, accountName: "" },',
  '      profit: { grossSales, productCost, adSpendUsd: profitSettings.adSpendUsd, adSpendBdt: profitSettings.adSpendBdt, dollarRate: profitSettings.dollarRate, confirmedOrders, courierCost, courierCostPerOrder: profitSettings.courierCostPerOrder, cancelRate: profitSettings.cancelRate, cancellationAdjustment, netProfit, netProfitMargin, connected: profitSettings.connected, accountName: profitSettings.accountName, error: profitSettings.error ?? null },',
  "restore full profit response",
);

if (dashboardChanged) await writeFile(dashboardPath, dashboard, "utf8");
if (optimizedChanged) await writeFile(optimizedPath, optimized, "utf8");

console.log(`Dashboard fixes complete. dashboardChanged=${dashboardChanged} optimizedChanged=${optimizedChanged}`);
