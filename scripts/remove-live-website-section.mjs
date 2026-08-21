import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "../src/components/admin/PremiumDashboard.tsx");
let source = await readFile(target, "utf8");

// Remove the complete Live Website block by stable neighbouring markers instead
// of trying to parse nested JSX with a non-greedy regex. The old regex could stop
// at an inner </div> and leave the section in the production bundle.
const liveStart = '<div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]"><Section title="Live Website"';
const nextSection = '<div className="grid gap-4 xl:grid-cols-2"><Section title="Top Selling Products · Real Orders">';

const start = source.indexOf(liveStart);
if (start !== -1) {
  const next = source.indexOf(nextSection, start);
  if (next === -1) {
    throw new Error("Live Website section found but next dashboard section marker was not found; refusing unsafe rewrite.");
  }
  source = source.slice(0, start) + source.slice(next);
  await writeFile(target, source, "utf8");
  console.log("Removed Dashboard Live Website section completely.");
} else if (!source.includes('title="Live Website"')) {
  console.log("Dashboard Live Website section already removed.");
} else {
  throw new Error("Live Website section found in an unexpected layout; refusing unsafe rewrite.");
}
