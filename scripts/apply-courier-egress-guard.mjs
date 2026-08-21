import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "../src/routes/admin/orders.tsx");
let source = await readFile(target, "utf8");
let changed = false;

function replaceIfPresent(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    console.warn(`Admin order UI patch skipped (${label}): source pattern not found.`);
    return;
  }
  source = source.replace(from, to);
  changed = true;
  console.log(`Applied admin order UI patch: ${label}`);
}

// Courier rows should use the normal guarded history loader. That loader reads the
// persistent cache first and, only on a cache miss, refreshes through the configured
// Hoorin API using the global rate/concurrency guard. Do not force cache-only mode,
// otherwise new phone numbers can never populate the Courier Success Rate column.
replaceIfPresent(
  "    queryFn: () => fn({ data: { phone: digits, cacheOnly: true } }),",
  "    queryFn: () => fn({ data: { phone: digits } }),",
  "courier rows refresh missing Hoorin history safely",
);
// The selected-order action strip must remain completely visible on phones. Allow wrapping,
// preserve every button, and prevent the strip itself from clipping its contents.
replaceIfPresent(
  '        <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-3 py-2.5 text-sm flex-wrap shadow-sm">',
  '        <div className="mb-3 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-3 py-2.5 text-sm flex-wrap overflow-visible shadow-sm">',
  "selected-order action strip stays visible",
);

// The outer card previously clipped horizontal/overflow content. The inner table owns scrolling.
replaceIfPresent(
  '      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">',
  '      <div className="bg-white border border-slate-200 rounded-xl overflow-visible shadow-sm">',
  "order card no longer clips controls",
);

// On narrow screens do not squeeze six columns until text/buttons disappear. Keep the desktop-like
// layout shown by the client and let the user scroll horizontally instead.
replaceIfPresent(
  '    <div className="overflow-x-auto">\n      <table className="w-full text-sm">',
  '    <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">\n      <table className="w-full min-w-[980px] lg:min-w-full text-sm table-auto">',
  "mobile table keeps all columns readable",
);

replaceIfPresent(
  '<th className="text-left p-3">Courier Success Rate</th>',
  '<th className="text-left p-3 whitespace-nowrap min-w-[190px]">Courier Success Rate</th>',
  "courier header width",
);

replaceIfPresent(
  '<th className="text-right p-3">Action</th>',
  '<th className="text-right p-3 whitespace-nowrap min-w-[150px]">Action</th>',
  "action header width",
);

replaceIfPresent(
  '<td className="p-3 min-w-[180px]">\n                  <CourierSuccessCell phone={o.customer_phone} />',
  '<td className="p-3 min-w-[190px] whitespace-nowrap">\n                  <CourierSuccessCell phone={o.customer_phone} />',
  "courier values never collapse",
);

replaceIfPresent(
  '<td className="p-3 text-right">\n                  {(() => {',
  '<td className="p-3 text-right min-w-[150px] whitespace-nowrap">\n                  {(() => {',
  "action column never collapses",
);

// Show the customer's full address instead of hiding useful lines with line-clamp on the admin table.
replaceIfPresent(
  '<div className="text-xs text-muted-foreground line-clamp-2">',
  '<div className="text-xs text-muted-foreground break-words leading-relaxed">',
  "full customer address is visible",
);

// Bulk action labels such as courier account names / invoice / duplicate / shipped must not split
// into broken fragments or shrink out of view.
replaceIfPresent(
  'className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 ${TONE_CLASSES[tone]}`}',
  'className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 ${TONE_CLASSES[tone]}`}',
  "bulk action buttons remain readable",
);

if (changed) {
  await writeFile(target, source, "utf8");
  console.log("Admin Order List visibility + live Hoorin courier-rate guard applied successfully.");
} else {
  console.log("Admin Order List visibility + live Hoorin courier-rate guard already applied.");
}
