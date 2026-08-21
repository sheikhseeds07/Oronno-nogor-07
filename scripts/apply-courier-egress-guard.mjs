import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "../src/routes/admin/orders.tsx");
let source = await readFile(target, "utf8");

// Keep the original Courier Success Rate UI exactly as before, but force the
// order-table lookup into cache-only mode. This means rendering the table can
// read persistent courier_history_cache data but can never invoke the external
// courier-history Edge Function for every visible row. This comment-only touch
// also triggers a clean Cloudflare rebuild so production cannot stay on the old
// Fraud check / Open order placeholder bundle after the UI fix is merged.
const automaticLookup = "    queryFn: () => fn({ data: { phone: digits } }),";
const cacheOnlyLookup = "    queryFn: () => fn({ data: { phone: digits, cacheOnly: true } }),";

if (source.includes(cacheOnlyLookup)) {
  console.log("Courier egress guard already applied: old success-rate UI uses cache-only row lookups.");
} else if (source.includes(automaticLookup)) {
  source = source.replace(automaticLookup, cacheOnlyLookup);
  await writeFile(target, source, "utf8");
  console.log("Applied courier egress guard: restored old success-rate UI with cache-only row lookups.");
} else {
  throw new Error("CourierSuccessCell lookup not found; refusing to build with an unknown order-table layout.");
}
