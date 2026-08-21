import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "../src/components/admin/PremiumDashboard.tsx");
let source = await readFile(target, "utf8");

const liveWebsiteSection = /<div className="grid gap-4 xl:grid-cols-\[1\.65fr_1fr\]"><Section title="Live Website"[\s\S]*?<\/Section><\/div>/;

if (liveWebsiteSection.test(source)) {
  source = source.replace(liveWebsiteSection, "");
  await writeFile(target, source, "utf8");
  console.log("Removed Dashboard Live Website section.");
} else if (!source.includes('title="Live Website"')) {
  console.log("Dashboard Live Website section already removed.");
} else {
  throw new Error("Live Website section found in an unexpected layout; refusing unsafe rewrite.");
}
