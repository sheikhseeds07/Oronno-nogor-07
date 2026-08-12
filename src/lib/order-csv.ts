// Client-safe parser for bulk order files (CSV / JSON export from Facebook order bot).

export type ParsedItem = {
  product_name: string;
  price: number;
  quantity: number;
};

export type ParsedOrder = {
  order_ref: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  notes: string | null;
  total: number;
  items: ParsedItem[];
};

/** Split a CSV text into rows of cells (handles quotes + embedded newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function itemsFromJson(raw: string): ParsedItem[] {
  try {
    const arr = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it) => ({
        product_name: String(it.productName ?? it.product_name ?? it.name ?? "").trim(),
        price: num(it.price),
        quantity: Math.max(1, Math.round(num(it.quantity) || 1)),
      }))
      .filter((it) => it.product_name);
  } catch {
    return [];
  }
}

/** Map a CSV/JSON file's contents into importable orders. */
export function parseOrdersFile(text: string, fileName: string): { orders: ParsedOrder[]; errors: string[] } {
  const errors: string[] = [];
  const isJson = /\.json$/i.test(fileName) || text.trim().startsWith("[") || text.trim().startsWith("{");

  const records: Record<string, string>[] = [];
  if (isJson) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const o of arr as Record<string, unknown>[]) {
        const rec: Record<string, string> = {};
        for (const [k, v] of Object.entries(o)) {
          rec[k.toLowerCase().trim()] = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
        }
        records.push(rec);
      }
    } catch {
      errors.push("JSON ফাইল পড়া যায়নি");
    }
  } else {
    const rows = parseCsv(text);
    if (!rows.length) errors.push("ফাইল খালি");
    const header = (rows[0] ?? []).map((h) => h.toLowerCase().trim());
    for (const r of rows.slice(1)) {
      const rec: Record<string, string> = {};
      header.forEach((h, i) => { rec[h] = (r[i] ?? "").trim(); });
      records.push(rec);
    }
  }

  const orders: ParsedOrder[] = [];
  records.forEach((rec, idx) => {
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = rec[k];
        if (v && v.trim()) return v.trim();
      }
      return "";
    };

    const name = pick("customer_name", "name", "facebook_id_name", "customer");
    const phone = pick("phone", "customer_phone", "mobile");
    if (!name || !phone) {
      errors.push(`লাইন ${idx + 2}: নাম বা ফোন নেই — বাদ দেওয়া হলো`);
      return;
    }

    let items = itemsFromJson(pick("line_items_json", "items", "line_items"));
    const total = num(pick("total_bdt", "total", "amount"));
    if (!items.length) {
      const pname = pick("products", "product", "product_name");
      if (pname) items = [{ product_name: pname, price: total, quantity: 1 }];
    }
    if (!items.length) {
      errors.push(`লাইন ${idx + 2}: প্রোডাক্ট নেই — বাদ দেওয়া হলো`);
      return;
    }

    orders.push({
      order_ref: pick("order_ref", "order_id", "ref") || null,
      customer_name: name,
      customer_phone: phone,
      customer_address: pick("address", "customer_address", "full_address") || null,
      notes: pick("remarks", "notes", "note") || null,
      total,
      items,
    });
  });

  return { orders, errors };
}
