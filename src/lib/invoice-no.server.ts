// Server-only helper: allocates courier invoice numbers using the
// admin-configurable prefix (All API → Invoice) e.g. AA1, AA2, AA3...
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const NAME = "invoice_settings";

export async function getInvoiceConfig(): Promise<{ prefix: string; next: number }> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("config")
    .eq("name", NAME)
    .maybeSingle();
  const cfg = (data?.config as { prefix?: string; next?: number } | undefined) ?? {};
  return { prefix: (cfg.prefix || "AA").trim(), next: Math.max(1, Number(cfg.next ?? 1)) };
}

/** Returns the next unused invoice number and persists the counter. */
export async function allocateInvoiceNo(): Promise<string> {
  const { prefix, next } = await getInvoiceConfig();
  let n = next;
  // Skip numbers already used by existing orders.
  for (let guard = 0; guard < 500; guard++) {
    const candidate = `${prefix}${n}`;
    const { data: taken } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("invoice_no", candidate)
      .limit(1);
    if (!taken || !taken.length) break;
    n++;
  }
  const invoice = `${prefix}${n}`;
  await supabaseAdmin.from("integrations").upsert(
    { name: NAME, is_active: true, config: { prefix, next: n + 1 }, updated_at: new Date().toISOString() },
    { onConflict: "name" },
  );
  return invoice;
}

/** Ensures the order has an invoice number in the configured format. */
export async function ensureOrderInvoiceNo(orderId: string, current: string | null): Promise<string> {
  const { prefix } = await getInvoiceConfig();
  if (current && current.startsWith(prefix)) return current;
  const invoice = await allocateInvoiceNo();
  await supabaseAdmin.from("orders").update({ invoice_no: invoice }).eq("id", orderId);
  return invoice;
}
