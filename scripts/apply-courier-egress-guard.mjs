import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "../src/routes/admin/orders.tsx");
let source = await readFile(target, "utf8");

const oldRowLookup = "                  <CourierSuccessCell phone={o.customer_phone} />";
const guardedRow = `                  <div className="text-[11px] leading-tight text-slate-500">
                    <div className="font-semibold text-slate-700">Fraud check</div>
                    <div>Open order to view courier history</div>
                  </div>`;

if (source.includes(oldRowLookup)) {
  source = source.replace(oldRowLookup, guardedRow);
  await writeFile(target, source, "utf8");
  console.log("Applied courier egress guard: order rows no longer auto-run courier history lookups.");
} else if (source.includes("Open order to view courier history")) {
  console.log("Courier egress guard already applied.");
} else {
  throw new Error("CourierSuccessCell row lookup not found; refusing to build with an unknown order-table layout.");
}
