import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "../src/routes/admin/orders.tsx");
let source = await readFile(target, "utf8");
let changed = false;

const oldDisplay = '  const displayRows = mode === "list" ? rows.slice((rtsPage - 1) * rtsPageSize, rtsPage * rtsPageSize) : rows;';
const newDisplay = `  const displayRows = mode === "list"
    ? [...rows]
        .sort((a, b) => {
          const aInvoice = a.invoice_no ?? "";
          const bInvoice = b.invoice_no ?? "";
          if (aInvoice && bInvoice) {
            return bInvoice.localeCompare(aInvoice, undefined, { numeric: true, sensitivity: "base" });
          }
          if (aInvoice) return -1;
          if (bInvoice) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice((rtsPage - 1) * rtsPageSize, rtsPage * rtsPageSize)
    : rows;`;

if (source.includes(oldDisplay)) {
  source = source.replace(oldDisplay, newDisplay);
  changed = true;
} else if (!source.includes(newDisplay)) {
  throw new Error("Order List display sorting block not found; refusing to build with an unknown layout.");
}

const oldPrint = '        return aInvoice.localeCompare(bInvoice, undefined, { numeric: true, sensitivity: "base" });';
const newPrint = '        return bInvoice.localeCompare(aInvoice, undefined, { numeric: true, sensitivity: "base" });';

if (source.includes(oldPrint)) {
  source = source.replace(oldPrint, newPrint);
  changed = true;
} else if (!source.includes(newPrint)) {
  throw new Error("Invoice print sorting block not found; refusing to build with an unknown layout.");
}

if (changed) {
  await writeFile(target, source, "utf8");
  console.log("Applied highest-invoice-first sorting to Order List and invoice printing.");
} else {
  console.log("Invoice descending sort already applied.");
}
