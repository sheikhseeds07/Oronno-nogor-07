export type MassageOrderSource = {
  originated_from_import?: boolean | null;
  notes?: string | null;
};

/**
 * Single source of truth for imported/"massage" orders.
 * Historical imports may not have originated_from_import set, so the
 * persisted Ref: marker remains a supported fallback.
 */
export function isMassageOrder(order: MassageOrderSource | null | undefined): boolean {
  if (!order) return false;
  return Boolean(
    order.originated_from_import ||
    /(?:^|\s)Ref\s*:/i.test(String(order.notes ?? "")),
  );
}
