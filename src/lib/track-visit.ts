// Batched, low-egress site visit tracking.
// Visits are queued in the browser and sent as one insert batch instead of one
// Supabase request per page-view. No heartbeat requests are generated.
import { supabase } from "@/lib/personal-supabase/client";

const SESSION_KEY = "sk_visit_sid";
const QUEUE_KEY = "sk_visit_queue_v2";
const SENT_KEY = "sk_visit_sent_v2";
const FLUSH_INTERVAL_MS = 60_000;
const MAX_BATCH = 25;

type Visit = { session_id: string; path: string; referrer: string | null; user_agent: string };

function createSessionId(): string {
  try {
    const cryptoApi = globalThis.crypto as Crypto & { randomUUID?: unknown } | undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID() as string;
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) { id = createSessionId(); sessionStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch { return createSessionId(); }
}
function readQueue(): Visit[] {
  try { const raw = localStorage.getItem(QUEUE_KEY); return raw ? (JSON.parse(raw) as Visit[]) : []; } catch { return []; }
}
function writeQueue(queue: Visit[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100))); } catch {}
}
function getSentSet(): Set<string> {
  try { const raw = sessionStorage.getItem(SENT_KEY); return new Set(raw ? (JSON.parse(raw) as string[]) : []); } catch { return new Set(); }
}
function markSent(path: string, set: Set<string>) {
  set.add(path);
  try { sessionStorage.setItem(SENT_KEY, JSON.stringify([...set].slice(-200))); } catch {}
}
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;

const SEED_COMBO_ITEMS = [
  ["বিটরুট", "৫ পিস", "Beetroot.jpg"],
  ["কেরালা শিম", "৫ পিস", "Kerala beans.jpg"],
  ["করলা", "৫ পিস", "Bitter melon.jpg"],
  ["উস্তে", "৫ পিস", "Bitter melon.jpg"],
  ["লাউ", "৫ পিস", "Bottle gourd.jpg"],
  ["শষা", "২০+ পিস", "Cucumber.jpg"],
  ["চিচিঙ্গা", "৫ পিস", "Snake gourd.jpg"],
  ["মিষ্টি কুমড়া", "৫ পিস", "Pumpkin.jpg"],
  ["মরিচ", "২০+ পিস", "Chili pepper.jpg"],
  ["বেগুন", "২০+ পিস", "Eggplant.jpg"],
  ["ঢেরষ", "১৫+ বীজ", "Okra.jpg"],
  ["বরবটি", "৭+ পিস", "Yardlong bean.jpg"],
  ["ধুন্দল", "৭+ পিস", "Sponge gourd.jpg"],
  ["ঝিঙা", "৭+ পিস", "Ridge gourd.jpg"],
  ["চালকুমড়া", "৮+ পিস", "Winter melon.jpg"],
  ["ধনিয়া", "১ জিপার", "Coriander.jpg"],
  ["পালন শাক", "১ জিপার", "Spinach.jpg"],
  ["পুই শাক", "১ জিপার", "Malabar spinach.jpg"],
  ["কলমি শাক", "১ জিপার", "Water spinach.jpg"],
  ["সবুজ শাক", "১ জিপার", "Amaranth greens.jpg"],
  ["লাল শাক", "১ জিপার", "Red amaranth.jpg"],
  ["ডাটা শাক", "১ জিপার", "Stem amaranth.jpg"],
  ["সুগন্ধি শাক", "১ জিপার", "Herbs.jpg"],
  ["নাফা শাক", "১ জিপার", "Leafy greens.jpg"],
] as const;

function ensureSeedComboItems() {
  if (typeof document === "undefined" || window.location.pathname !== "/landing/seedcombo") return;
  if (document.getElementById("seedcombo-items-premium")) return;

  const order = document.querySelector("#order");
  if (!order) return;

  const style = document.createElement("style");
  style.id = "seedcombo-items-premium-style";
  style.textContent = `
    .seedcombo-items-premium{width:100%;max-width:520px;margin:18px auto 24px;padding:18px 14px 16px;border:1px solid rgba(16,122,79,.16);border-radius:24px;background:linear-gradient(180deg,#ffffff 0%,#f7fff9 100%);box-shadow:0 18px 45px -28px rgba(6,78,59,.55);position:relative;overflow:hidden}
    .seedcombo-items-premium:before{content:"";position:absolute;width:180px;height:180px;right:-90px;top:-90px;border-radius:50%;background:rgba(34,197,94,.09);filter:blur(2px);pointer-events:none}
    .seedcombo-items-head{text-align:center;position:relative;z-index:1;margin:0 0 14px}
    .seedcombo-items-kicker{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:#ecfdf3;color:#087443;font-size:10px;font-weight:900;letter-spacing:.04em;margin-bottom:7px}
    .seedcombo-items-title{margin:0;color:#064e3b;font-size:21px;font-weight:950;line-height:1.25;letter-spacing:-.02em}
    .seedcombo-items-sub{margin:5px 0 0;color:#64748b;font-size:11px;font-weight:650}
    .seedcombo-items-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;position:relative;z-index:1}
    .seedcombo-item-card{min-width:0;border:1px solid #e2eee6;border-radius:15px;background:rgba(255,255,255,.96);padding:7px 6px 8px;box-shadow:0 7px 18px -13px rgba(6,78,59,.5);transform:translateY(10px) scale(.985);opacity:0;transition:transform .55s cubic-bezier(.22,1,.36,1),opacity .55s ease,box-shadow .25s ease,border-color .25s ease}
    .seedcombo-item-card.is-visible{transform:translateY(0) scale(1);opacity:1}
    .seedcombo-item-card:hover{transform:translateY(-3px) scale(1.015);border-color:#b9dfc8;box-shadow:0 14px 24px -15px rgba(6,78,59,.62)}
    .seedcombo-item-img-wrap{position:relative;width:100%;aspect-ratio:1/0.82;border-radius:11px;overflow:hidden;background:linear-gradient(135deg,#edf9f0,#f8faf9);margin-bottom:7px}
    .seedcombo-item-img-wrap:after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 25%,rgba(255,255,255,.48) 48%,transparent 65%);transform:translateX(-120%);animation:seedcomboImageShine 4.5s ease-in-out infinite;pointer-events:none}
    .seedcombo-item-img{width:100%;height:100%;display:block;object-fit:cover;transition:transform .55s cubic-bezier(.22,1,.36,1);background:#f1f5f2}
    .seedcombo-item-card:hover .seedcombo-item-img{transform:scale(1.075)}
    .seedcombo-item-name{font-size:12px;font-weight:850;color:#123b2c;line-height:1.3;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .seedcombo-item-qty{display:block;width:max-content;max-width:100%;margin:4px auto 0;padding:2px 7px;border-radius:999px;background:#effaf3;color:#087443;font-size:9px;font-weight:850;line-height:1.35;white-space:nowrap}
    @keyframes seedcomboImageShine{0%,55%,100%{transform:translateX(-120%)}70%{transform:translateX(120%)}}
    @media(max-width:640px){.seedcombo-items-premium{margin:14px auto 20px;padding:15px 8px 13px;border-radius:20px}.seedcombo-items-title{font-size:19px}.seedcombo-items-grid{gap:6px}.seedcombo-item-card{border-radius:13px;padding:6px 5px 7px}.seedcombo-item-img-wrap{border-radius:9px;margin-bottom:6px}.seedcombo-item-name{font-size:11px}.seedcombo-item-qty{font-size:8px;padding:2px 6px}}
    @media(prefers-reduced-motion:reduce){.seedcombo-item-card{transition:none;transform:none!important;opacity:1}.seedcombo-item-img-wrap:after{animation:none}}
  `;
  document.head.appendChild(style);

  const section = document.createElement("section");
  section.id = "seedcombo-items-premium";
  section.className = "seedcombo-items-premium";
  section.setAttribute("aria-label", "Seed Combo contents");
  section.innerHTML = `
    <div class="seedcombo-items-head">
      <div class="seedcombo-items-kicker">🌱 PREMIUM SEED COLLECTION</div>
      <h2 class="seedcombo-items-title">এক কম্বোতেই ২৪ প্রকার বীজ 🌿</h2>
      <p class="seedcombo-items-sub">প্রতিটি বীজের নাম ও পরিমাণ এক নজরে দেখে নিন</p>
    </div>
    <div class="seedcombo-items-grid"></div>
  `;

  const grid = section.querySelector(".seedcombo-items-grid") as HTMLElement;
  const imageBase = "https://commons.wikimedia.org/wiki/Special:FilePath/";
  SEED_COMBO_ITEMS.forEach(([name, qty, file], index) => {
    const card = document.createElement("article");
    card.className = "seedcombo-item-card";
    card.style.transitionDelay = `${Math.min(index * 28, 420)}ms`;
    const image = document.createElement("img");
    image.className = "seedcombo-item-img";
    image.loading = index < 6 ? "eager" : "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.alt = `${name} — ${qty}`;
    image.src = `${imageBase}${encodeURIComponent(file)}`;
    image.onerror = () => { image.style.visibility = "hidden"; };
    const wrap = document.createElement("div");
    wrap.className = "seedcombo-item-img-wrap";
    wrap.appendChild(image);
    const title = document.createElement("div");
    title.className = "seedcombo-item-name";
    title.textContent = name;
    const amount = document.createElement("span");
    amount.className = "seedcombo-item-qty";
    amount.textContent = qty;
    card.append(wrap, title, amount);
    grid.appendChild(card);
  });

  order.parentElement?.insertBefore(section, order);

  const cards = Array.from(section.querySelectorAll<HTMLElement>(".seedcombo-item-card"));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -35px 0px" });
    cards.forEach((card) => observer.observe(card));
  } else cards.forEach((card) => card.classList.add("is-visible"));
}

function ensureSeedComboCheckoutSpacing() {
  if (typeof document === "undefined" || window.location.pathname !== "/landing/seedcombo") return;
  if (!document.getElementById("seedcombo-checkout-spacing-fix")) {
    const style = document.createElement("style");
    style.id = "seedcombo-checkout-spacing-fix";
    style.textContent = `
      #order{margin-top:24px!important;padding-top:10px!important}
      #order #lp-order-form{margin-top:8px!important}
      @media(max-width:640px){#order{margin-top:22px!important;padding-top:8px!important}#order #lp-order-form{margin-top:7px!important}}
    `;
    document.head.appendChild(style);
  }
  ensureSeedComboItems();
}

export async function flushVisitQueue() {
  if (typeof window === "undefined" || flushing) return;
  const queue = readQueue();
  if (!queue.length) return;
  flushing = true;
  const batch = queue.slice(0, MAX_BATCH);
  try {
    const { error } = await supabase.from("site_visits").insert(batch);
    if (!error) writeQueue(queue.slice(batch.length));
  } catch {} finally { flushing = false; }
}
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = undefined; void flushVisitQueue(); }, FLUSH_INTERVAL_MS);
}
export function trackVisit(path: string) {
  if (typeof window === "undefined") return;
  const normalizedPath = path || window.location.pathname;
  if (normalizedPath === "/landing/seedcombo") {
    ensureSeedComboCheckoutSpacing();
    if (!document.getElementById("seedcombo-items-premium")) {
      const observer = new MutationObserver(() => {
        if (document.getElementById("order")) {
          ensureSeedComboCheckoutSpacing();
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 10000);
    }
  }
  const sent = getSentSet();
  if (sent.has(normalizedPath)) return;
  markSent(normalizedPath, sent);
  const queue = readQueue();
  queue.push({ session_id: getSessionId(), path: normalizedPath, referrer: document.referrer || null, user_agent: navigator.userAgent.slice(0, 200) });
  writeQueue(queue);
  scheduleFlush();
  if (queue.length >= MAX_BATCH) void flushVisitQueue();
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void flushVisitQueue(), { passive: true });
  window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushVisitQueue(); });
}