// Shared blocked-customer signalling between the order server function and the
// checkout / landing UIs. Keep this module client-safe (no server imports).
export const BLOCKED_ORDER_CODE = "CUSTOMER_BLOCKED";
export const BLOCKED_ORDER_MESSAGE = "আপনাকে Block করা হয়েছে। আপনি আর অর্ডার করতে পারবেন না।";

function installPremiumOrderToastStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById("premium-order-error-toast-style")) return;

  const style = document.createElement("style");
  style.id = "premium-order-error-toast-style";
  style.textContent = `
    [data-sonner-toast][data-type="error"] {
      width: min(420px, calc(100vw - 28px)) !important;
      min-height: 72px !important;
      padding: 14px 42px 14px 16px !important;
      border: 1px solid rgba(220,38,38,.14) !important;
      border-radius: 18px !important;
      background: rgba(255,255,255,.98) !important;
      box-shadow: 0 18px 48px -22px rgba(15,23,42,.34), 0 2px 8px rgba(15,23,42,.06) !important;
      backdrop-filter: blur(14px) !important;
      font-family: inherit !important;
    }
    [data-sonner-toast][data-type="error"] [data-icon] {
      width: 34px !important;
      height: 34px !important;
      min-width: 34px !important;
      border-radius: 999px !important;
      display: grid !important;
      place-items: center !important;
      background: linear-gradient(135deg,#ecfdf5,#d1fae5) !important;
      color: #059669 !important;
      border: 1px solid #a7f3d0 !important;
    }
    [data-sonner-toast][data-type="error"] [data-title] {
      color: #0f172a !important;
      font-size: 14px !important;
      line-height: 1.65 !important;
      font-weight: 750 !important;
      white-space: pre-line !important;
    }
    [data-sonner-toast][data-type="error"] [data-description] {
      color: #64748b !important;
      font-size: 12px !important;
      line-height: 1.55 !important;
    }
    [data-sonner-toast][data-type="error"] [data-close-button] {
      width: 26px !important;
      height: 26px !important;
      top: 9px !important;
      right: 9px !important;
      border-radius: 999px !important;
      border: 1px solid #e2e8f0 !important;
      background: #fff !important;
      color: #64748b !important;
    }
    @media (max-width:640px) {
      [data-sonner-toast][data-type="error"] {
        width: calc(100vw - 20px) !important;
        border-radius: 16px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function formatDuplicateOrderMessage(message: string): string | null {
  if (!/আপনি ইতিমধ্যে একটি অর্ডার করেছেন/i.test(message)) return null;

  const match = message.match(/আরও\s*([0-9]+)\s*মিনিট/);
  const minutes = match ? Number(match[1]) : 0;
  let waitText = "";

  if (Number.isFinite(minutes) && minutes > 0) {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    const parts: string[] = [];
    if (days) parts.push(`${days} দিন`);
    if (hours) parts.push(`${hours} ঘণ্টা`);
    if (mins) parts.push(`${mins} মিনিট`);
    waitText = parts.join(" ");
  }

  return waitText
    ? `আপনার একটি অর্ডার ইতিমধ্যে গ্রহণ করা হয়েছে।\nদয়া করে অপেক্ষা করুন—আমাদের টিম আপনাকে কল করে অর্ডারটি কনফার্ম করবে।\n\nপরবর্তী অর্ডারের জন্য অপেক্ষা: ${waitText}।`
    : `আপনার একটি অর্ডার ইতিমধ্যে গ্রহণ করা হয়েছে।\nদয়া করে অপেক্ষা করুন—আমাদের টিম আপনাকে কল করে অর্ডারটি কনফার্ম করবে।`;
}

export function isBlockedOrderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes(BLOCKED_ORDER_CODE);
}

/** Clean, customer-facing message for any order error (never raw DB text for blocks). */
export function orderErrorMessage(err: unknown, fallback = "অর্ডার করতে সমস্যা হয়েছে"): string {
  installPremiumOrderToastStyle();
  if (isBlockedOrderError(err)) return BLOCKED_ORDER_MESSAGE;
  const msg = err instanceof Error ? err.message : "";
  return formatDuplicateOrderMessage(msg) || msg || fallback;
}
