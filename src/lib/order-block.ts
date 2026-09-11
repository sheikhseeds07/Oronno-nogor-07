// Shared blocked-customer signalling between the order server function and the checkout / landing UIs. Keep this module client-safe (no server imports).
export const BLOCKED_ORDER_CODE = "CUSTOMER_BLOCKED";
export const BLOCKED_ORDER_MESSAGE = "আপনাকে Block করা হয়েছে। আপনি আর অর্ডার করতে পারবেন না।";

function installPremiumOrderModalStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById("premium-order-error-modal-style")) return;
  const style = document.createElement("style");
  style.id = "premium-order-error-modal-style";
  style.textContent = `
    @keyframes premiumOrderModalIn { from { opacity:0; transform:translateY(18px) scale(.96); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes premiumOrderBackdropIn { from { opacity:0; } to { opacity:1; } }
    @keyframes premiumOrderPulse { 0%,100% { box-shadow:0 0 0 0 rgba(22,163,74,.18); } 50% { box-shadow:0 0 0 9px rgba(22,163,74,0); } }
    @keyframes premiumOrderShine { from { transform:translateX(-120%) rotate(18deg); } to { transform:translateX(220%) rotate(18deg); } }
    .premium-order-modal-backdrop { position:fixed; inset:0; z-index:99999; display:grid; place-items:center; padding:20px; background:rgba(15,23,42,.46); backdrop-filter:blur(8px); animation:premiumOrderBackdropIn .22s ease-out; }
    .premium-order-modal { position:relative; width:min(430px,calc(100vw - 32px)); overflow:hidden; border:1px solid rgba(22,163,74,.16); border-radius:28px; background:linear-gradient(145deg,#ffffff 0%,#f8fffa 58%,#ffffff 100%); box-shadow:0 30px 90px -28px rgba(15,23,42,.48),0 8px 30px rgba(6,78,59,.12); animation:premiumOrderModalIn .32s cubic-bezier(.2,.8,.2,1); font-family:inherit; }
    .premium-order-modal::before { content:""; position:absolute; inset:0 0 auto; height:4px; background:linear-gradient(90deg,#16a34a,#84cc16,#f59e0b,#22c55e,#16a34a); background-size:220% 100%; animation:premiumOrderShine 3.8s linear infinite; }
    .premium-order-modal-close { position:absolute; top:14px; right:14px; width:34px; height:34px; border:1px solid #e2e8f0; border-radius:50%; background:rgba(255,255,255,.9); color:#64748b; font-size:22px; line-height:1; cursor:pointer; z-index:2; transition:.2s ease; }
    .premium-order-modal-close:hover { transform:rotate(90deg); background:#f8fafc; color:#0f172a; }
    .premium-order-modal-body { padding:32px 26px 25px; text-align:center; }
    .premium-order-modal-icon { width:66px; height:66px; margin:0 auto 16px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(145deg,#ecfdf5,#d1fae5); border:1px solid #a7f3d0; color:#059669; animation:premiumOrderPulse 2.2s ease-in-out infinite; }
    .premium-order-modal-icon svg { width:31px; height:31px; }
    .premium-order-modal-title { margin:0 34px 10px; color:#14532d; font-size:21px; line-height:1.3; font-weight:900; letter-spacing:-.02em; }
    .premium-order-modal-text { margin:0 auto; max-width:360px; color:#475569; font-size:14px; line-height:1.75; font-weight:600; }
    .premium-order-modal-text strong { color:#166534; font-weight:850; }
    .premium-order-countdown { margin:18px auto 10px; padding:13px 15px; border:1px solid #dcfce7; border-radius:18px; background:linear-gradient(135deg,#f0fdf4,#ffffff); }
    .premium-order-countdown-label { margin-bottom:7px; color:#64748b; font-size:11px; font-weight:800; }
    .premium-order-countdown-value { color:#0f172a; font:900 25px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.04em; font-variant-numeric:tabular-nums; }
    .premium-order-modal-note { margin:8px 0 18px; color:#94a3b8; font-size:11px; font-weight:700; }
    .premium-order-modal-ok { width:100%; min-height:49px; border:0; border-radius:15px; background:linear-gradient(135deg,#15803d,#16a34a,#22c55e); color:#fff; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 12px 25px -13px rgba(21,128,61,.75); transition:transform .18s ease,box-shadow .18s ease; }
    .premium-order-modal-ok:hover { transform:translateY(-1px); box-shadow:0 16px 30px -13px rgba(21,128,61,.85); }
    @media(max-width:640px) { .premium-order-modal-backdrop{padding:14px}.premium-order-modal{width:calc(100vw - 28px);border-radius:24px}.premium-order-modal-body{padding:28px 19px 20px}.premium-order-modal-title{font-size:19px}.premium-order-modal-text{font-size:13px}.premium-order-countdown-value{font-size:22px} }
    @media(prefers-reduced-motion:reduce){.premium-order-modal,.premium-order-modal-backdrop,.premium-order-modal-icon,.premium-order-modal::before{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function duplicateOrderMinutes(message: string): number | null {
  if (!/আপনি ইতিমধ্যে একটি অর্ডার করেছেন/i.test(message)) return null;
  const match = message.match(/আরও\s*([0-9]+)\s*মিনিট/);
  const minutes = match ? Number(match[1]) : null;
  return minutes !== null && Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function showDuplicateOrderModal(message: string) {
  if (typeof document === "undefined") return;
  installPremiumOrderModalStyle();
  document.querySelector(".premium-order-modal-backdrop")?.remove();
  const minutes = duplicateOrderMinutes(message);
  const totalSeconds = minutes !== null ? minutes * 60 : 0;
  const backdrop = document.createElement("div");
  backdrop.className = "premium-order-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  const formatTime = (seconds: number) => { const safe=Math.max(0,seconds); const h=Math.floor(safe/3600); const m=Math.floor((safe%3600)/60); const s=safe%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };
  backdrop.innerHTML = `<div class="premium-order-modal"><button class="premium-order-modal-close" type="button" aria-label="বন্ধ করুন">×</button><div class="premium-order-modal-body"><div class="premium-order-modal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h2 class="premium-order-modal-title">একটু অপেক্ষা করুন</h2><p class="premium-order-modal-text">আপনি ইতিমধ্যে একটি অর্ডার করেছেন। দয়া করে অপেক্ষা করুন, আপনাকে কল করা হবে।<br>পরবর্তী অর্ডার করতে আরও <strong>${minutes ?? 0} মিনিট</strong> অপেক্ষা করুন।</p>${minutes !== null ? `<div class="premium-order-countdown"><div class="premium-order-countdown-label">পরবর্তী অর্ডারের জন্য বাকি সময়</div><div class="premium-order-countdown-value" data-order-countdown>${formatTime(totalSeconds)}</div></div>` : ""}<p class="premium-order-modal-note">সময় শেষ হলে আবার অর্ডার করতে পারবেন।</p><button class="premium-order-modal-ok" type="button">ঠিক আছে</button></div></div>`;
  document.body.appendChild(backdrop);
  const close = () => { backdrop.remove(); if (timer) clearInterval(timer); document.removeEventListener("keydown", onKey); };
  const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
  backdrop.querySelector(".premium-order-modal-close")?.addEventListener("click", close);
  backdrop.querySelector(".premium-order-modal-ok")?.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  document.addEventListener("keydown", onKey);
  let remaining = totalSeconds;
  const countdown = backdrop.querySelector("[data-order-countdown]");
  const timer = minutes !== null ? setInterval(() => { remaining=Math.max(0,remaining-1); if(countdown) countdown.textContent=formatTime(remaining); if(remaining<=0) clearInterval(timer); },1000) : null;
}

export function isBlockedOrderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes(BLOCKED_ORDER_CODE);
}

/** Clean, customer-facing message for any order error (never raw DB text for blocks). */
export function orderErrorMessage(err: unknown, fallback = "অর্ডার করতে সমস্যা হয়েছে"): string {
  if (isBlockedOrderError(err)) return BLOCKED_ORDER_MESSAGE;
  const msg = err instanceof Error ? err.message : "";
  if (duplicateOrderMinutes(msg) !== null) { showDuplicateOrderModal(msg); return ""; }
  return msg || fallback;
}
