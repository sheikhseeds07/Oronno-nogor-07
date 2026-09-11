import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardPath = path.resolve(here, "../src/components/admin/PremiumDashboard.tsx");
const landingPath = path.resolve(here, "../src/components/landing/CleanLandingPage.tsx");

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

// Restore the original dark-green Seed Combo headline treatment without touching
// the landing page's other cleanup/removal changes.
let landing = await readFile(landingPath, "utf8");
const landingOriginal = landing;
landing = landing
  .replace(
    '.top-hook{width:100%;max-width:520px;margin:0 auto;padding:16px 14px;text-align:center;background:transparent;position:relative;color:#064e3b;overflow:hidden;border-bottom:5px solid #ffd700;box-shadow:none;border-radius:0 0 18px 18px}',
    '.top-hook{width:100%;max-width:520px;margin:0 auto;padding:16px 14px;text-align:center;background:linear-gradient(120deg,#1b4332,#2d6a4f);position:relative;color:#fff;overflow:hidden;border-bottom:5px solid #ffd700;box-shadow:0 8px 20px rgba(0,0,0,0.4);border-radius:0 0 18px 18px}',
  )
  .replace(
    '.top-hook h1{font-size:34px;font-weight:900;margin:0 0 8px 0;letter-spacing:.5px;line-height:1.25;text-shadow:none}',
    '.top-hook h1{font-size:34px;font-weight:900;margin:0 0 8px 0;letter-spacing:.5px;line-height:1.25;text-shadow:0 2px 8px rgba(0,0,0,0.5)}',
  )
  .replace(
    '.hook-delivery{font-size:16px;opacity:.95;display:flex;justify-content:center;align-items:center;gap:6px;color:#064e3b}',
    '.hook-delivery{font-size:16px;opacity:.95;display:flex;justify-content:center;align-items:center;gap:6px}',
  );

if (landing !== landingOriginal) {
  await writeFile(landingPath, landing, "utf8");
  console.log("Applied Seed Combo patch: restore dark-green headline background");
} else {
  console.log("Seed Combo dark-green headline patch already applied or source pattern not found; continuing build.");
}

console.log(`Dashboard range fix complete. dashboardChanged=${dashboardChanged}`);
