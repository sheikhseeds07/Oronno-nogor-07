import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardPath = path.resolve(here, "../src/components/admin/PremiumDashboard.tsx");

let dashboard = await readFile(dashboardPath, "utf8");
let dashboardChanged = false;

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

if (dashboardChanged) await writeFile(dashboardPath, dashboard, "utf8");
console.log(`Dashboard range fix complete. dashboardChanged=${dashboardChanged}`);
