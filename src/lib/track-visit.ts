// Page-level enhancements that run on navigation (seed combo landing grid).
// Raw page-view logging was removed: it stored hundreds of thousands of rows
// that no screen ever read. Visitor stats come from site_visitors instead.
import { supabase } from "@/lib/personal-supabase/client";
import { toImg } from "@/lib/img";


type Seed = { name: string; qty: string; image?: string };

function addSeedGridStyles() {
  if (document.getElementById("seedcombo-items-premium-style")) return;
  const style = document.createElement("style");
  style.id = "seedcombo-items-premium-style";
  style.textContent = `
    .seedcombo-items-premium{width:100%;max-width:520px;margin:0 auto;padding:16px 10px 15px;border:1px solid rgba(16,122,79,.16);border-radius:22px;background:linear-gradient(180deg,#fff,#f7fff9);box-shadow:0 18px 45px -28px rgba(6,78,59,.55);position:relative;overflow:hidden}
    .seedcombo-items-premium:before{content:"";position:absolute;width:180px;height:180px;right:-95px;top:-95px;border-radius:50%;background:rgba(34,197,94,.08);pointer-events:none}
    .seedcombo-items-head{text-align:center;position:relative;z-index:1;margin:0 0 13px}
    .seedcombo-items-kicker{display:inline-flex;padding:4px 9px;border-radius:999px;background:#ecfdf3;color:#087443;font-size:9px;font-weight:900;letter-spacing:.04em;margin-bottom:6px}
    .seedcombo-items-title{margin:0;color:#064e3b;font-size:20px;font-weight:900;line-height:1.25;letter-spacing:-.02em}
    .seedcombo-items-sub{margin:4px 0 0;color:#64748b;font-size:10px;font-weight:650}
    .seedcombo-items-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;position:relative;z-index:1}
    .seedcombo-item-card{min-width:0;border:1px solid #e2eee6;border-radius:14px;background:rgba(255,255,255,.98);padding:6px 5px 7px;box-shadow:0 7px 18px -13px rgba(6,78,59,.5);opacity:1}
    .seedcombo-item-img-wrap{position:relative;width:100%;aspect-ratio:1/0.82;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#edf9f0,#f8faf9);margin-bottom:6px}
    .seedcombo-item-img{width:100%;height:100%;display:block;object-fit:cover;background:#f1f5f2;content-visibility:visible}
    .seedcombo-item-name{font-size:11px;font-weight:850;color:#123b2c;line-height:1.3;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .seedcombo-item-qty{display:block;width:max-content;max-width:100%;margin:4px auto 0;padding:2px 7px;border-radius:999px;background:#effaf3;color:#087443;font-size:8px;font-weight:850;line-height:1.35;white-space:nowrap}
    .seedcombo-item-placeholder{width:100%;height:100%;display:grid;place-items:center;font-size:28px;color:#16834b;background:linear-gradient(135deg,#ecfdf3,#f8faf9)}
    @media(max-width:640px){.seedcombo-items-premium{border-radius:20px;padding:14px 7px 12px}.seedcombo-items-grid{gap:6px}.seedcombo-item-card{border-radius:12px;padding:5px 4px 6px}.seedcombo-item-img-wrap{border-radius:9px}.seedcombo-item-name{font-size:10.5px}.seedcombo-item-qty{font-size:8px;padding:2px 6px}.seedcombo-items-title{font-size:18px}}
  ;
  document.head.appendChild(style);
}

async function ensureSeedComboItems() {
  if (typeof document === "undefined" || window.location.pathname !== "/landing/seedcombo") return;
  if (document.getElementById("seedcombo-items-premium")) return;
  const table = document.querySelector(".combo-table");
  if (!table) return;
  addSeedGridStyles();
  const { data } = await supabase.from("landing_pages").select("planting_steps").eq("slug", "seedcombo").eq("is_published", true).maybeSingle();
  const raw = (data?.planting_steps as { seed_table?: unknown } | null)?.seed_table;
  const seeds: Seed[] = Array.isArray(raw) ? raw.filter((x): x is Seed => !!x && typeof x === "object" && typeof (x as Seed).name === "string").slice(0, 24) : [];
  if (!seeds.length) return;

  const section = document.createElement("section");
  section.id = "seedcombo-items-premium";
  section.className = "seedcombo-items-premium";
  section.setAttribute("aria-label", "Seed Combo contents");
  section.innerHTML = `<div class="seedcombo-items-head"><div class="seedcombo-items-kicker">🌱 PREMIUM SEED COLLECTION</div><h2 class="seedcombo-items-title">${escapeHtml("໫໪ ৯রুচোর বীজ ঙ੬যৄযৄ েক কম্বোতেই 🌿")}</h2><p class="seedcombo-items-sub">পরতिটিটिর বীজের নাম ओ পরিমাণ ঄গ নजरে</p></div><div class="seedcombo-items-grid"></div>`;
  const grid = section.querySelector(".seedcombo-items-grid") as HTMLElement;
  seeds.forEach((seed, index) => {
    const card = document.createElement("article");
    card.className = "seedcombo-item-card";
    const wrap = document.createElement("div");
    wrap.className = "seedcombo-item-img-wrap";
    if (seed.image) {
      const image = document.createElement("img");
      image.className = "seedcombo-item-img";
      // Never lazy-load: lazy + a replaced DOM node made some cards stay blank
      // until tapped. All 24 thumbnails are tiny and cached through /media.
      image.loading = "eager";
      // Facebook's in-app WebView can leave asynchronously decoded images on
      // transformed cards unpainted until a tap forces a repaint.
      image.decoding = "sync";
      image.width = 140;
      image.height = 115;
      image.alt = `${seed.name} — ${seed.qty}`;
      image.src = toImg(seed.image);
      let retried = false;
      image.onerror = () => {
        if (!retried && seed.image) { retried = true; image.src = seed.image; return; }
        wrap.innerHTML = `<div class="seedcombo-item-placeholder">🌱</div>`;
      };
      wrap.appendChild(image);
    } else {
      wrap.innerHTML = `<div class="seedcombo-item-placeholder">🌱</div>`;
    }
    const title = document.createElement("div"); title.className = "seedcombo-item-name"; title.textContent = seed.name;
    const amount = document.createElement("span"); amount.className = "seedcombo-item-qty"; amount.textContent = seed.qty;
    card.append(wrap, title, amount); grid.appendChild(card);
  });

  table.replaceWith(section);
}

function escapeHtml(value: string) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }

function ensureSeedCombo() {
  if (typeof document === "undefined" || window.location.pathname !== "/landing/seedcombo") return;
  const spacingId = "seedcombo-checkout-spacing-fix";
  if (!document.getElementById(spacingId)) {
    const style = document.createElement("style"); style.id = spacingId;
    style.textContent = `#order{margin-top:24px!important;padding-top:10px!important}#order #lp-order-form{margin-top:8px!important}@media(max-width:640px){#order{margin-top:22px!important;padding-top:8px!important}#order #lp-order-form{margin-top:7px!important}}`;
    document.head.appendChild(style);
  }
  void ensureSeedComboItems();
}

export function trackVisit(path: string) {
  if (typeof window === "undefined") return;
  const normalizedPath = path || window.location.pathname;
  if (normalizedPath === "/landing/seedcombo") {
    ensureSeedCombo();
    if (!document.getElementById("seedcombo-items-premium")) {
      const observer = new MutationObserver(() => { if (document.querySelector(".combo-table")) { ensureSeedCombo(); observer.disconnect(); } });
      observer.observe(document.body, { childList: true, subtree: true }); setTimeout(() => observer.disconnect(), 10000);
    }
  }
}
