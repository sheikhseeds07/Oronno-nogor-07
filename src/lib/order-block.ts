// Shared blocked-customer signalling between the order server function and the
// checkout / landing UIs. Keep this module client-safe (no server imports).
export const BLOCKED_ORDER_CODE = "CUSTOMER_BLOCKED";
export const BLOCKED_ORDER_MESSAGE = "আপনাকে Block করা হয়েছে। আপনি আর অর্ডার করতে পারবেন না।";

export function isBlockedOrderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes(BLOCKED_ORDER_CODE);
}

/** Clean, customer-facing message for any order error (never raw DB text for blocks). */
export function orderErrorMessage(err: unknown, fallback = "অর্ডার করতে সমস্যা হয়েছে"): string {
  if (isBlockedOrderError(err)) return BLOCKED_ORDER_MESSAGE;
  const msg = err instanceof Error ? err.message : "";
  return msg || fallback;
}
