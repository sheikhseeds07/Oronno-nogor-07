import { toast } from "sonner";

// Shared blocked-customer signalling between the order server function and the checkout / landing UIs. Keep this module client-safe (no server imports).
export const BLOCKED_ORDER_CODE = "CUSTOMER_BLOCKED";
export const BLOCKED_ORDER_MESSAGE = "আপনাকে Block করা হয়েছে। আপনি আর অর্ডার করতে পারবেন না।";

function installPremiumOrderModalStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById("premium-order-error-modal-style")) return;
  const style = document.createElement("style");
  style.id = "premium-order-error-modal-style";
  style.textContent = `
    @keyframes premiumOrderModalIn { from { opacity:0; transform:translateY(24px) scale(.94); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes premiumOrderBackdropIn { from { opacity:0; } to { opacity:1; } }
    @keyframes premiumOrderPulse { 0%,100% { transform:scale(1); box-shadow:0 0 0 0 rgba(22,163,74,.16); } 50% { transform:scale(1.035); box-shadow:0 0 0 11px rgba(22,163,74,0); } }
    @keyframes premiumOrderShine { from { transform:translateX(-130%) rotate(16deg); } to { transform:translateX(230%) rotate(16deg); } }
    @keyframes premiumOrderCheck { 0% { stroke-dashoffset:30; } 65% { stroke-dashoffset:0; } 100% { stroke-dashoffset:0; } }
    .premium-order-modal-backdrop { position:fixed; inset:0; z-index:99999; display:grid; place-items:center; padding:18px; background:rgba(2,8,23,.56); backdrop-filter:blur(11px) saturate(115%); animation:premiumOrderBackdropIn .22s ease-out; }
    .premium-order-modal { position:relative; width:min(440px,calc(100vw - 28px)); overflow:hidden; border:1px solid rgba(255,255,255,.8); border-radius:30px; background:linear-gradient(145deg,#ffffff 0%,#fbfffc 52%,#f4fff7 100%); box-shadow:0 38px 100px -28px rgba(2,8,23,.62),0 14px 38px rgba(6,78,59,.18); animation:premiumOrderModalIn .38s cubic-bezier(.18,.82,.2,1); font-family:inherit; }
    .premium-order-modal::before { content:""; position:absolute; inset:0 0 auto; height:5px; background:linear-gradient(90deg,#15803d,#22c55e,#a3e635,#22c55e,#15803d); background-size:240% 100%; animation:premiumOrderShine 4s linear infinite; }
    body.premium-order-modal-active [data-sonner-toast] { display:none !important; }
    .premium-order-modal-close { position:absolute; top:15px; right:15px; width:35px; height:35px; border:1px solid #e2e8f0; border-radius:50%; background:rgba(255,255,255,.94); color:#64748b; font-size:22px; line-height:1; cursor:pointer; z-index:3; transition:all .2s ease; box-shadow:0 5px 16px rgba(15,23,42,.07); }
    .premium-order-modal-close:hover { transform:rotate(90deg) scale(1.05); background:#f0fdf4; color:#166534; border-color:#bbf7d0; }
    .premium-order-modal-body { padding:35px 28px 27px; text-align:center; }
    .premium-order-modal-icon-wrap { width:78px; height:78px; margin:0 auto 17px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(145deg,#ecfdf5,#dcfce7); border:7px solid #f7fffa; box-shadow:0 9px 30px rgba(22,163,74,.13),inset 0 0 0 1px #bbf7d0; animation:premiumOrderPulse 2.4s ease-in-out infinite; }
    .premium-order-modal-icon { width:56px; height:56px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(145deg,#16a34a,#15803d); color:#fff; box-shadow:0 8px 20px rgba(21,128,61,.28); }
    .premium-order-modal-icon svg { width:28px; height:28px; }
    .premium-order-modal-icon path { stroke-dasharray:30; stroke-dashoffset:30; animation:premiumOrderCheck .65s .12s ease-out forwards; }
    .premium-order-modal-eyebrow { display:inline-flex; align-items:center; gap:6px; margin-bottom:8px; padding:5px 10px; border-radius:999px; background:#ecfdf5; color:#15803d; font-size:10px; font-weight:900; letter-spacing:.04em; }
    .premium-order-modal-title { margin:0 35px 11px; color:#123b24; font-size:23px; line-height:1.28; font-weight:950; letter-spacing:-.025em; }
    .premium-order-modal-text { margin:0 auto; max-width:370px; color:#526273; font-size:14px; line-height:1.8; font-weight:600; }
    .premium-order-modal-text strong { color:#15803d; font-weight:900; }
    .premium-order-countdown { position:relative; margin:19px auto 11px; padding:14px 16px 15px; border:1px solid #d9f5e2; border-radius:20px; background:linear-gradient(135deg,#f0fdf4,#ffffff); box-shadow:inset 0 1px 0 rgba(255,255,255,.9); }
    .premium-order-countdown-label { margin-bottom:8px; color:#7a8795; font-size:10px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; }
    .premium-order-countdown-value { color:#10251a; font:950 27px/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.055em; font-variant-numeric:tabular-nums; }
    .premium-order-modal-note { margin:9px 0 19px; color:#8a98a7; font-size:11px; font-weight:700; }
    .premium-order-modal-ok { position:relative; overflow:hidden; width:100%; min-height:51px; border:0; border-radius:16px; background:linear-gradient(135deg,#166534 0%,#16a34a 52%,#22c55e 100%); color:#fff; font-size:15px; font-weight:950; cursor:pointer; box-shadow:0 14px 28px -14px rgba(21,128,61,.85); transition:transform .18s ease,box-shadow .18s ease,filter .18s ease; }
    .premium-order-modal-ok::after { content:""; position:absolute; top:-60%; left:-25%; width:22%; height:220%; background:rgba(255,255,255,.22); transform:rotate(18deg); animation:premiumOrderShine 3.2s ease-in-out infinite; }
    .premium-order-modal-ok:hover { transform:translateY(-2px); filter:saturate(1.08); box-shadow:0 18px 34px -13px rgba(21,128,61,.9); }
    .premium-order-modal-ok:active { transform:translateY(0) scale(.99); }
    @media(max-width:640px) { .premium-order-modal-backdrop{padding:12px}.premium-order-modal{width:calc(100vw - 24px);border-radius:26px}.premium-order-modal-body{padding:31px 18px 22px}.premium-order-modal-icon-wrap{width:72px;height:72px}.premium-order-modal-icon{width:51px;height:51px}.premium-order-modal-title{font-size:20px}.premium-order-modal-text{font-size:13px}.premium-order-countdown-value{font-size:23px} }
    @media(prefers-reduced-motion:reduce){.premium-order-modal,.premium-order-modal-backdrop,.premium-order-modal-icon-wrap,.premium-order-modal-icon path,.premium-order-modal::before,.premium-order-modal-ok::after{animation:none!important}.premium-order-modal-icon path{stroke-dashoffset:0!important}}
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
  document.body.classList.add("premium-order-modal-active");
  const minutes = duplicateOrderMinutes(message);
  const totalSeconds = minutes !== null ? minutes * 60 : 0;
  const backdrop = document.createElement("div");
  backdrop.className = "premium-order-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  const formatTime = (seconds: number) => { const safe=Math.max(0,seconds); const h=Math.floor(safe/3600); const m=Math.floor((safe%3600)/60); const s=safe%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };
  backdrop.innerHTML = `<div class="premium-order-modal"><button class="premium-order-modal-close" type="button" aria-label="বন্ধ করুন">×</button><div class="premium-order-modal-body"><div class="premium-order-modal-icon-wrap"><div class="premium-order-modal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7"><path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div><div class="premium-order-modal-eyebrow">✓ অর্ডার স্ট্যাটাস</div><h2 class="premium-order-modal-title">একটু অপেক্ষা করুন</h2><p class="premium-order-modal-text">আপনি ইতিমধ্যে একটি অর্ডার করেছেন। দয়া করে অপেক্ষা করুন, আপনাকে কল করা হবে।<br>পরবর্তী অর্ডার করতে আরও <strong>${minutes ?? 0} মিনিট</strong> অপেক্ষা করুন।</p>${minutes !== null ? `<div class="premium-order-countdown"><div class="premium-order-countdown-label">পরবর্তী অর্ডারের জন্য বাকি সময়</div><div class="premium-order-countdown-value" data-order-countdown>${formatTime(totalSeconds)}</div></div>` : ""}<p class="premium-order-modal-note">সময় শেষ হলে আবার অর্ডার করতে পারবেন।</p><button class="premium-order-modal-ok" type="button">ঠিক আছে</button></div></div>`;
  document.body.appendChild(backdrop);
  let timer: ReturnType<typeof setInterval> | null = null;
  const close = () => { backdrop.remove(); document.body.classList.remove("premium-order-modal-active"); if (timer) clearInterval(timer); document.removeEventListener("keydown", onKey); };
  const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
  backdrop.querySelector(".premium-order-modal-close")?.addEventListener("click", close);
  backdrop.querySelector(".premium-order-modal-ok")?.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  document.addEventListener("keydown", onKey);
  let remaining = totalSeconds;
  const countdown = backdrop.querySelector("[data-order-countdown]");
  timer = minutes !== null ? setInterval(() => { remaining=Math.max(0,remaining-1); if(countdown) countdown.textContent=formatTime(remaining); if(remaining<=0 && timer){ clearInterval(timer); timer=null; } },1000) : null;
}

function showBlockedOrderModal() {
  if (typeof document === "undefined") return;
  installPremiumOrderModalStyle();
  document.querySelector(".premium-order-modal-backdrop")?.remove();
  document.body.classList.add("premium-order-modal-active");
  const backdrop = document.createElement("div");
  backdrop.className = "premium-order-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.innerHTML = `<div class="premium-order-modal"><button class="premium-order-modal-close" type="button" aria-label="বন্ধ করুন">×</button><div class="premium-order-modal-body"><div class="premium-order-modal-icon-wrap"><div class="premium-order-modal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 3l7.5 3.4v5.2c0 4.6-3.1 7.9-7.5 9.4-4.4-1.5-7.5-4.8-7.5-9.4V6.4L12 3z" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 11.6h5m0 0v.1" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div><div class="premium-order-modal-eyebrow">শেখ সিডস • অর্ডার স্ট্যাটাস</div><h2 class="premium-order-modal-title">অর্ডারটি নেওয়া যাচ্ছে না</h2><p class="premium-order-modal-text">দুঃখিত, এই <strong>মোবাইল নম্বর</strong> থেকে আপাতত অর্ডার নেওয়া বন্ধ রাখা হয়েছে।<br>কোনো ভুল হয়েছে মনে হলে আমাদের পেজে মেসেজ দিয়ে জানান — আমরা দেখে ঠিক করে দেব।</p><p class="premium-order-modal-note">সহায়তার জন্য: শেখ সিডস অফিশিয়াল পেজে মেসেজ করুন।</p><button class="premium-order-modal-ok" type="button">বুঝেছি</button></div></div>`;
  document.body.appendChild(backdrop);
  const close = () => { backdrop.remove(); document.body.classList.remove("premium-order-modal-active"); document.removeEventListener("keydown", onKey); };
  const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
  backdrop.querySelector(".premium-order-modal-close")?.addEventListener("click", close);
  backdrop.querySelector(".premium-order-modal-ok")?.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  document.addEventListener("keydown", onKey);
}

export function isBlockedOrderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes(BLOCKED_ORDER_CODE);
}

/** Clean, customer-facing message for any order error (never raw DB text for blocks). */
export function orderErrorMessage(err: unknown, fallback = "অর্ডার করতে সমস্যা হয়েছে"): string {
  if (isBlockedOrderError(err)) { showBlockedOrderModal(); return ""; }
  const msg = err instanceof Error ? err.message : "";
  if (duplicateOrderMinutes(msg) !== null) { showDuplicateOrderModal(msg); return ""; }
  return msg || fallback;
}


/** Show an order error to the customer. Stays silent when the premium popup already handled it (no empty red toast). */
export function notifyOrderError(err: unknown, fallback = "অর্ডার করতে সমস্যা হয়েছে") {
  const message = orderErrorMessage(err, fallback);
  if (message) toast.error(message);
}
