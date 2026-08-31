import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { LegacyLandingPage } from "@/components/landing/LegacyLandingPage";
import { CleanLandingPage } from "@/components/landing/CleanLandingPage";
import { ProfessionalLandingPage } from "@/components/landing/ProfessionalLandingPage";
import { ProductStyleLandingPage } from "@/components/landing/ProductStyleLandingPage";
import { mergeContent } from "@/lib/landing-content";
import { landingBaseSlug } from "@/lib/landing-slug";

const LEGACY_SLUGS = new Set(["seeds-combo-24"]);
export const Route = createFileRoute("/landing/$slug")({ component: LandingPage });

const seedComboCheckoutCss = `
#order { scroll-margin-top: 76px !important; margin-top: -22px !important; padding-top: 0 !important; }
#order > .mb-4.text-center { margin-bottom: 10px !important; }
#order #lp-order-form { position:relative; overflow:hidden; border:1px solid rgba(21,128,61,.16) !important; border-radius:26px !important; padding:12px !important; background:linear-gradient(145deg,#fff 0%,#f7fff9 48%,#fff 100%) !important; box-shadow:0 20px 55px -30px rgba(6,78,59,.45),0 0 0 1px rgba(255,255,255,.8) inset !important; }
#order #lp-order-form::before { content:"";position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#16a34a,#f59e0b,#22c55e,#0ea5e9,#16a34a);background-size:220% 100%;animation:seedComboGradient 4s linear infinite; }
#order #lp-order-form::after { content:"";position:absolute;width:180px;height:180px;right:-90px;top:20px;border-radius:999px;background:radial-gradient(circle,rgba(34,197,94,.11),transparent 68%);pointer-events:none; }
@keyframes seedComboGradient { to { background-position:220% 0; } }
#order #lp-order-form > .border-2.rounded-2xl.p-3 { position:relative;z-index:1;margin:0 0 8px !important;padding:8px !important;border:1px solid rgba(21,128,61,.14) !important;border-radius:18px !important;background:linear-gradient(135deg,rgba(240,253,244,.96),rgba(255,255,255,.98)) !important;box-shadow:0 7px 20px -18px rgba(6,78,59,.5) !important; }
#order #lp-order-form > .border-2.rounded-2xl.p-3 .space-y-2 { gap:6px !important; }
#order #lp-order-form > .border-2.rounded-2xl.p-3 .space-y-2 > button { min-height:54px !important;padding:7px 9px !important;border-radius:14px !important;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease,background .2s ease !important; }
#order #lp-order-form > .border-2.rounded-2xl.p-3 .space-y-2 > button:hover { transform:translateY(-1px);box-shadow:0 8px 18px -15px rgba(6,78,59,.65); }
#order #lp-order-form > .border-2.rounded-2xl.p-3 .space-y-2 > button:first-child { animation:seedComboSelected 2.4s ease-in-out infinite; }
@keyframes seedComboSelected { 0%,100% { box-shadow:0 0 0 0 rgba(34,197,94,.16); } 50% { box-shadow:0 0 0 5px rgba(34,197,94,0); } }
#order #lp-order-form > .border-2.rounded-2xl.p-3 + * { margin-top:0 !important; }
#order #lp-order-form label { font-weight:800 !important;color:#17351f !important; }
#order #lp-order-form input:not([type="checkbox"]),#order #lp-order-form textarea { min-height:48px !important;border:1.5px solid #d7e7dc !important;border-radius:13px !important;background:rgba(255,255,255,.9) !important;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease !important; }
#order #lp-order-form input:not([type="checkbox"]):focus,#order #lp-order-form textarea:focus { border-color:#22c55e !important;box-shadow:0 0 0 4px rgba(34,197,94,.11) !important;transform:translateY(-1px); }
#order #lp-order-form textarea { min-height:78px !important; }
#order #lp-order-form .divide-y { margin-top:8px !important;border-radius:15px !important;overflow:hidden;border:1px solid #dfeae2;background:#fff; }
#order #lp-order-form .divide-y > div { padding-top:8px !important;padding-bottom:8px !important; }
#order #lp-order-form .divide-y > div:last-child { background:linear-gradient(90deg,#ecfdf3,#f0fdf4) !important; }
#order .lp-checkout-reassurance { margin:8px 2px !important;font-size:12px !important; }
#order #lp-order-form button[type="submit"] { display:none !important; }
#order #lp-order-form button[type="button"] { transition:transform .18s ease,box-shadow .18s ease !important; }
#order #lp-order-form button[type="button"]:active { transform:scale(.985); }
@media (max-width:640px) { #order { margin-top:-26px !important;padding-bottom:110px !important; } #order > .mb-4.text-center { margin-bottom:7px !important; } #order #lp-order-form { padding:8px !important;border-radius:22px !important; } #order #lp-order-form > .border-2.rounded-2xl.p-3 { margin-bottom:6px !important;padding:6px !important;border-radius:16px !important; } #order #lp-order-form > .border-2.rounded-2xl.p-3 .space-y-2 > button { min-height:50px !important;padding:6px 7px !important;border-radius:12px !important; } #order #lp-order-form input:not([type="checkbox"]),#order #lp-order-form textarea { min-height:50px !important;font-size:16px !important; } #order #lp-order-form textarea { min-height:82px !important; } }
@media (min-width:641px) { #order { padding-bottom:100px !important; } }
@media (prefers-reduced-motion: reduce) { #order #lp-order-form::before,#order #lp-order-form > .border-2.rounded-2xl.p-3 .space-y-2 > button:first-child { animation:none !important; } }
.lp-footer-wrap { display:none !important; }
`;

const karalaCompactCss = `
html,body { scroll-padding-top:0 !important; }
body { padding-top:0 !important; }
body:has(.lp-hdr-timer) header,body:has(.lp-hdr-timer) [class*="sticky"]:has(.lp-hdr-timer),body:has(.lp-hdr-timer) [class*="fixed"]:has(.lp-hdr-timer),body:has(.lp-hdr-timer) div:has(> .lp-hdr-timer) { display:none !important;height:0 !important;min-height:0 !important;max-height:0 !important;margin:0 !important;padding:0 !important;border:0 !important;overflow:hidden !important; }
header { display:none !important;height:0 !important;min-height:0 !important;margin:0 !important;padding:0 !important; }
main { padding-top:0 !important;margin-top:0 !important; }
main > div:first-child { margin-top:0 !important;padding-top:0 !important; }
.lp-root { padding-top:0 !important;margin-top:0 !important; }
`;

const productCompactCss = `
.sticky.top-0 { display:none !important; }
header { display:none !important; }
main { padding-top:6px !important; padding-bottom:10px !important; }
main > section:first-of-type { padding:10px !important; border-radius:22px !important; }
main > * + * { margin-top:8px !important; }
main .hng-product-head { padding:12px 10px 10px !important; border-radius:18px !important; }
main .hng-price { margin-top:7px !important; }
main .hng-gift { margin-top:6px !important; }
main .hng-trust { margin-top:6px !important; padding-top:6px !important; }
main .hng-image-compact-cta { margin:6px 0 0 !important; }
main .hng-section-cta { margin:0 0 2px !important; }
#product-order { scroll-margin-top:6px !important; }
@media (max-width:640px) { main { padding-left:10px !important; padding-right:10px !important; } main > * + * { margin-top:7px !important; } }
`;

function LandingPopupBehavior({ enabled, hideReviews, hideHeader, compact }: { enabled: boolean; hideReviews?: boolean; hideHeader?: boolean; compact?: boolean }) {
  useEffect(() => {
    if ((!enabled && !hideReviews && !hideHeader) || typeof document === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    let activePopup: Element | null = null;
    const closePopup = () => { const popup = activePopup ?? document.querySelector('.fixed.inset-0.z-\\[60\\]'); popup?.querySelector<HTMLButtonElement>('button[aria-label="বন্ধ করুন"], button[aria-label="close"]')?.click(); };
    const removeReviews = () => { if (!hideReviews) return; const markers = ["কাস্টমার রিভিউ","কাস্টমার ফিডব্যাক","ক্রেতারা যা বলছেন","সন্তুষ্ট কাস্টমারদের মতামত","রাশেদুল ইসলাম","সুমাইয়া আক্তার","মাহবুব হাসান"]; for (const section of document.querySelectorAll("section")) { const text = section.textContent?.trim() || ""; if (markers.some(marker => text.includes(marker))) section.remove(); } };
    const hideOrderTexts = () => { if (!hideReviews) return; const exactTexts = new Set(["ধাপ ২","ডেলিভারি তথ্য দিন"]); for (const el of document.querySelectorAll("div,p,h2,h3")) { const text = el.textContent?.trim() || ""; if (exactTexts.has(text)) el.setAttribute("data-seedcombo-hidden-copy","true"); } for (const el of document.querySelectorAll("[data-seedcombo-hidden-copy]")) (el as HTMLElement).style.visibility = "hidden"; };
    const hideLandingHeader = () => { if (!hideHeader) return; const hide = (el: HTMLElement | null) => { if (!el) return; el.style.setProperty("display","none","important");el.style.setProperty("height","0","important");el.style.setProperty("min-height","0","important");el.style.setProperty("margin","0","important");el.style.setProperty("padding","0","important");el.style.setProperty("overflow","hidden","important"); }; document.querySelectorAll("header").forEach(el => hide(el as HTMLElement)); for (const timerEl of Array.from(document.querySelectorAll(".lp-hdr-timer"))) { let node = timerEl.parentElement as HTMLElement | null; for (let depth=0;node&&depth<6;depth++,node=node.parentElement) { if (node.querySelector("img")) { hide(node);break; } } } document.querySelectorAll('[class*="sticky"]').forEach(el => { if ((el as HTMLElement).querySelector(".lp-hdr-timer")) hide(el as HTMLElement); }); };
    const moveCountdownToHeader = () => { if (!enabled || document.querySelector("[data-seedcombo-header-countdown]")) return; const header = document.querySelector("header") as HTMLElement | null; if (!header) return; const heading = Array.from(document.querySelectorAll("h2,h3,div")).find(el => el.textContent?.trim() === "অফারটি শেষ হতে আর মাত্র..."); const section = heading?.closest("section") as HTMLElement | null; if (!section) return; const orderButton = Array.from(header.querySelectorAll("button")).find(button => /অর্ডার/.test(button.textContent || "")) as HTMLButtonElement | undefined; if (!orderButton) return; orderButton.style.display="none";section.style.display="none"; const container = header.querySelector(".container") as HTMLElement | null; if (!container) return; container.style.display="flex";container.style.alignItems="center";container.style.justifyContent="space-between";container.style.gap="10px"; const box=document.createElement("div");box.dataset.seedcomboHeaderCountdown="1";box.setAttribute("role","timer");box.style.cssText="position:relative;overflow:hidden;flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:7px 9px;border:1px solid rgba(220,38,38,.16);border-radius:14px;background:linear-gradient(135deg,#fff,#fff7f7);box-shadow:0 8px 24px rgba(15,23,42,.08);";box.innerHTML=`<div style="font-size:8px;font-weight:900;color:#dc2626;white-space:nowrap">🔥 অফার শেষ হচ্ছে</div><div class="countdown-values" style="display:flex;align-items:flex-end;gap:3px;font-variant-numeric:tabular-nums;white-space:nowrap"></div>`;container.appendChild(box);const values=box.querySelector(".countdown-values") as HTMLElement;const startedAt=Date.now(),duration=3*60*60*1000;const render=()=>{const remaining=Math.max(0,duration-(Date.now()-startedAt));const h=Math.floor(remaining/3600000),m=Math.floor((remaining%3600000)/60000),s=Math.floor((remaining%60000)/1000);const unit=(v:number,l:string)=>`<span style="display:flex;flex-direction:column;align-items:center;min-width:24px"><strong style="font:800 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a">${String(v).padStart(2,"0")}</strong><small style="font-size:6px;font-weight:800;color:#94a3b8;margin-top:2px">${l}</small></span>`;values.innerHTML=`${unit(h,"ঘণ্টা")}<b style="color:#cbd5e1">:</b>${unit(m,"মিনিট")}<b style="color:#cbd5e1">:</b>${unit(s,"সেকেন্ড")}`;};render();countdownTimer=setInterval(render,1000); };
    const attach=()=>{if(enabled){const popup=document.querySelector('.fixed.inset-0.z-\\[60\\]');if(popup&&popup!==activePopup){activePopup=popup;if(timer)clearTimeout(timer);timer=setTimeout(closePopup,10000);}}removeReviews();hideOrderTexts();hideLandingHeader();moveCountdownToHeader();};
    attach();const observer=new MutationObserver(attach);observer.observe(document.body,{childList:true,subtree:true});const handlePopupCta=(event:MouseEvent)=>{if(!activePopup||!document.body.contains(activePopup))return;const target=event.target instanceof Element?event.target:null;if(!target||!activePopup.contains(target))return;const control=target.closest("button,a") as HTMLElement|null;if(!control)return;const label=(control.textContent||"").trim();const isClose=control.matches('button[aria-label="বন্ধ করুন"],button[aria-label="close"]');if(isClose)return;if(/এখনই অর্ডার করুন|অর্ডার করুন/.test(label)){event.preventDefault();event.stopPropagation();closePopup();}};document.addEventListener("click",handlePopupCta,true);return()=>{observer.disconnect();document.removeEventListener("click",handlePopupCta,true);if(timer)clearTimeout(timer);if(countdownTimer)clearInterval(countdownTimer);activePopup=null;};
  }, [enabled,hideReviews,hideHeader]);
  return <>{enabled && <style dangerouslySetInnerHTML={{__html:seedComboCheckoutCss}} />}{hideHeader && <style dangerouslySetInnerHTML={{__html:karalaCompactCss}} />}{compact && <style dangerouslySetInnerHTML={{__html:productCompactCss}} />}</>;
}

const isKaralaStyle = (slug: string) => landingBaseSlug(slug) === "karala";

function LandingPage() {
  const { slug } = useParams({ from: "/landing/$slug" });
  const behaviorSlug = landingBaseSlug(slug);
  const isLegacySlug = LEGACY_SLUGS.has(behaviorSlug);
  const isSeedCombo = behaviorSlug === "seedcombo";
  const COMPACT_SLUGS = new Set(["odc", "bagun"]);
  const compact = COMPACT_SLUGS.has(behaviorSlug);
  const karalaStyle = isKaralaStyle(slug);
  const hideHeader = karalaStyle || compact;
  const { data, isLoading } = useQuery({ enabled: !isLegacySlug && !isSeedCombo, staleTime:5*60_000, gcTime:30*60_000, queryKey:["landing-template",slug], queryFn:async() => (await supabase.from("landing_pages").select("planting_steps").eq("slug",slug).maybeSingle()).data ?? null });
  const popupBehaviorEnabled = isSeedCombo || behaviorSlug === "seeds-combo-24";
  const hideReviews = isSeedCombo || karalaStyle || compact;
  if (isLegacySlug) return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} compact={compact} /><LegacyLandingPage slug={slug} /></>;
  if (isSeedCombo) return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} hideHeader compact={compact} /><CleanLandingPage slug={slug} /></>;
  const template = mergeContent(data?.planting_steps).template as string;
  if (template === "product" || template === "all-product") return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} hideHeader={hideHeader} compact={compact} /><ProductStyleLandingPage slug={slug} /></>;
  if (template === "premium") return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} hideHeader={hideHeader} compact={compact} /><ProfessionalLandingPage slug={slug} variant="premium" /></>;
  if (template === "modern") return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} hideHeader={hideHeader} compact={compact} /><ProfessionalLandingPage slug={slug} variant="modern" /></>;
  if (isLoading && !data) return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} hideHeader={hideHeader} compact={compact} /><ProductStyleLandingPage slug={slug} /></>;
  if (template === "all") return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} hideHeader={hideHeader} compact={compact} /><LegacyLandingPage slug={slug} /></>;
  return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} hideHeader={hideHeader} compact={compact} /><CleanLandingPage slug={slug} /></>;
}
