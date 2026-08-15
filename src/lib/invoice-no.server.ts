// Server-only helper: allocates invoice numbers using the admin-configurable
// prefix (All API → Invoice ফরম্যাট) e.g. AA110, AA111, AA112...
// Invoice numbers are guaranteed unique: every candidate is checked against
// existing orders before the counter is persisted.
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const NAME = "invoice_settings";

const PREFIX = "AA"; // fixed invoice prefix: AA110, AA111, AA112...
const START_NUMBER = 110; // next invoice numbering starts at AA110

export async function getInvoiceConfig(): Promise<{ prefix: string; next: number }> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("config")
    .eq("name", NAME)
    .maybeSingle();
  const cfg = (data?.config as { next?: number } | undefined) ?? {};
  // Never go below AA110. If the site already has a higher counter, preserve it.
  return { prefix: PREFIX, next: Math.max(START_NUMBER, Number(cfg.next ?? START_NUMBER)) };
}

async function saveNext(prefix: string, next: number) {
  await supabaseAdmin.from("integrations").upsert(
    { name: NAME, is_active: true, config: { prefix, next }, updated_at: new Date().toISOString() },
    { onConflict: "name" },
  );
}

/** True when the invoice already follows the configured format (e.g. AA123). */
export function isValidInvoice(invoice: string | null, prefix: string): boolean {
  if (!invoice) return false;
  return new RegExp(`^${prefix.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\\\d+$`).test(invoice);
}

/**
 * Allocates `count` unique invoice numbers and persists the counter.
 * Any number already used by an order is skipped, so duplicates cannot happen.
 */
export async function allocateInvoiceNos(count = 1): Promise<string[]> {
  const { prefix, next } = await getInvoiceConfig();
  let start = next;

  for (let attempt = 0; attempt < 200; attempt++) {
    const candidates = Array.from({ length: count }, (_, i) => `${prefix}${start + i}`);
    const { data: taken } = await supabaseAdmin
      .from("orders")
      .select("invoice_no")
      .in("invoice_no", candidates);

    if (!taken || taken.length === 0) {
      await saveNext(prefix, start + count);
      return candidates;
    }

    // Jump past the highest colliding number and try again.
    const highest = taken.reduce((max, row) => {
      const n = Number(String(row.invoice_no ?? "").slice(prefix.length));
      return Number.isFinite(n) && n > max ? n : max;
    }, start);
    start = highest + 1;
  }

  throw new Error("ইনভয়েস নাম্বার তৈরি করা যাচ্ছে না — All API তে ইনভয়েস সেটিং চেক করুন");
}

/** Single invoice number in the configured format. */
export async function allocateInvoiceNo(): Promise<string> {
  const [invoice] = await allocateInvoiceNos(1);
  return invoice;
}

/** Ensures the order has an invoice number in the configured format. */
export async function ensureOrderInvoiceNo(orderId: string, current: string | null): Promise<string> {
  const { prefix } = await getInvoiceConfig();
  if (isValidInvoice(current, prefix)) return current as string;
  const invoice = await allocateInvoiceNo();
  await supabaseAdmin.from("orders").update({ invoice_no: invoice }).eq("id", orderId);
  return invoice;
}

/**
 * Makes sure every given order has a valid invoice number BEFORE its status
 * leaves the web stage — this keeps the old DB fallback (SK…) from firing.
 */
export async function ensureInvoicesForOrders(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { prefix } = await getInvoiceConfig();
  const { data: rows } = await supabaseAdmin
    .from("orders")
    .select("id,invoice_no")
    .in("id", ids);

  const result: Record<string, string> = {};
  const missing: string[] = [];
  for (const row of rows ?? []) {
    if (isValidInvoice(row.invoice_no, prefix)) result[row.id] = row.invoice_no as string;
    else missing.push(row.id);
  }
  if (!missing.length) return result;

  const invoices = await allocateInvoiceNos(missing.length);
  for (let i = 0; i < missing.length; i++) {
    await supabaseAdmin.from("orders").update({ invoice_no: invoices[i] }).eq("id", missing[i]);
    result[missing[i]] = invoices[i];
  }
  return result;
}
