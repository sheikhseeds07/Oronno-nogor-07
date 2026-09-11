import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardPath = path.resolve(here, "../src/components/admin/PremiumDashboard.tsx");

let dashboard = "";
try {
  dashboard = await readFile(dashboardPath, "utf8");
} catch {
  console.warn("PremiumDashboard.tsx not found; skipping build blocker fix.");
  process.exit(0);
}

const brokenLandingLabel = '{x.landingPages?.length?`Landing: ${x.landingPages.map((p:any)=>p.title).join(", ")}:`}';
const fixedLandingLabel = '{x.landingPages?.length?`Landing: ${x.landingPages.map((p:any)=>p.title).join(", ")}`:"No linked landing page"}';

if (dashboard.includes(brokenLandingLabel)) {
  dashboard = dashboard.replace(brokenLandingLabel, fixedLandingLabel);
  await writeFile(dashboardPath, dashboard, "utf8");
  console.log("Fixed PremiumDashboard landing-page ternary syntax.");
} else if (dashboard.includes(fixedLandingLabel)) {
  console.log("PremiumDashboard landing-page ternary syntax already fixed.");
} else {
  console.warn("PremiumDashboard landing-page expression not found; nothing to patch, continuing build.");
}
