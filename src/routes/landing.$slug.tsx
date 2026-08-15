import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { LegacyLandingPage } from "@/components/landing/LegacyLandingPage";
import { CleanLandingPage } from "@/components/landing/CleanLandingPage";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { mergeContent } from "@/lib/landing-content";

const LEGACY_SLUGS = new Set(["seeds-combo-24"]);

export const Route = createFileRoute("/landing/$slug")({ component: LandingPage });

function LandingPopupBehavior({ enabled, hideReviews }: { enabled: boolean; hideReviews?: boolean }) {
  useEffect(() => {
    if ((!enabled && !hideReviews) || typeof document === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    let activePopup: Element | null = null;

    const closePopup = () => {
      const popup = activePopup ?? document.querySelector('.fixed.inset-0.z-\\[60\\]');
      if (!popup) return;
      const closeButton = popup.querySelector<HTMLButtonElement>('button[aria-label="বন্ধ করুন"], button[aria-label="close"]');
      closeButton?.click();
    };

    const removeReviews = () => {
      if (!hideReviews) return;
      const reviewMarkers = ["কাস্টমার রিভিউ", "কাস্টমার ফিডব্যাক", "ক্রেতারা যা বলছেন", "সন্তুষ্ট কাস্টমারদের মতামত", "রাশেদুল ইসলাম", "সুমাইয়া আক্তার", "মাহবুব হাসান"];
      for (const section of document.querySelectorAll("section")) {
        const text = section.textContent?.trim() || "";
        if (reviewMarkers.some((marker) => text.includes(marker))) section.remove();
      }
    };

    const moveCountdownToHeader = () => {
      if (!enabled || document.querySelector("[data-seedcombo-header-countdown]")) return;
      const header = document.querySelector("header") as HTMLElement | null;
      if (!header) return;

      const heading = Array.from(document.querySelectorAll("h2, h3, div")).find(
        (el) => el.textContent?.trim() === "অফারটি শেষ হতে আর মাত্র...",
      );
      const section = heading?.closest("section") as HTMLElement | null;
      if (!section) return;

      const orderButton = Array.from(header.querySelectorAll("button")).find(
        (button) => /অর্ডার/.test(button.textContent || ""),
      ) as HTMLButtonElement | undefined;
      if (!orderButton) return;

      orderButton.style.display = "none";
      section.style.display = "none";

      // Premium header animation styles are scoped to the seedcombo countdown only.
      if (!document.querySelector("style[data-seedcombo-header-style]")) {
        const style = document.createElement("style");
        style.dataset.seedcomboHeaderStyle = "1";
        style.textContent = `
          @keyframes seedPulse { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.10),0 8px 24px rgba(15,23,42,.08)} 50%{box-shadow:0 0 0 5px rgba(220,38,38,.05),0 12px 30px rgba(15,23,42,.12)} }
          @keyframes seedShine { 0%{transform:translateX(-140%)} 55%,100%{transform:translateX(140%)} }
          @keyframes seedDot { 0%,100%{opacity:.35;transform:scale(.85)} 50%{opacity:1;transform:scale(1.15)} }
          @keyframes seedTick { 0%{transform:translateY(-2px);opacity:.65} 100%{transform:translateY(0);opacity:1} }
          [data-seedcombo-header-countdown]{animation:seedPulse 3.2s ease-in-out infinite;}
          [data-seedcombo-header-countdown] .seed-shine{animation:seedShine 4.5s ease-in-out infinite;}
          [data-seedcombo-header-countdown] .seed-dot{animation:seedDot 1.6s ease-in-out infinite;}
          [data-seedcombo-header-countdown] .seed-digit{animation:seedTick .28s ease-out;}
          @media (prefers-reduced-motion: reduce){[data-seedcombo-header-countdown],[data-seedcombo-header-countdown] .seed-shine,[data-seedcombo-header-countdown] .seed-dot,[data-seedcombo-header-countdown] .seed-digit{animation:none!important}}
        `;
        document.head.appendChild(style);
      }

      const container = header.querySelector(".container") as HTMLElement | null;
      if (!container) return;
      container.style.display = "flex";
      container.style.alignItems = "center";
      container.style.justifyContent = "space-between";
      container.style.gap = "10px";
      container.style.minWidth = "0";

      const brand = container.querySelector(":scope > div:first-child") as HTMLElement | null;
      if (brand) brand.style.minWidth = "0";

      const box = document.createElement("div");
      box.dataset.seedcomboHeaderCountdown = "1";
      box.setAttribute("role", "timer");
      box.setAttribute("aria-label", "অফার শেষ হওয়ার কাউন্টডাউন");
      box.style.cssText = `position:relative;overflow:hidden;flex:0 0 auto;display:flex;align-items:center;gap:9px;min-width:0;padding:7px 9px;border:1px solid rgba(220,38,38,.16);border-radius:14px;background:linear-gradient(135deg,#fff 0%,#fff7f7 100%);box-shadow:0 8px 24px rgba(15,23,42,.08);`;
      box.innerHTML = `
        <div class="seed-shine" style="position:absolute;inset:0 auto 0 0;width:38%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent);transform:translateX(-140%);pointer-events:none;"></div>
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:27px;height:27px;border-radius:9px;background:linear-gradient(135deg,#fee2e2,#fff);border:1px solid #fecaca;flex:0 0 auto;">
          <span class="seed-dot" style="width:7px;height:7px;border-radius:999px;background:#dc2626;box-shadow:0 0 0 4px rgba(220,38,38,.10);"></span>
        </div>
        <div style="position:relative;min-width:0;line-height:1;">
          <div style="font-size:8px;font-weight:900;letter-spacing:.08em;color:#dc2626;text-transform:uppercase;white-space:nowrap;margin-bottom:3px;">অফার শেষ হচ্ছে</div>
          <div style="font-size:8px;font-weight:600;color:#64748b;white-space:nowrap;">সীমিত সময়ের অফার</div>
        </div>
        <div class="countdown-values" style="position:relative;display:flex;align-items:flex-end;gap:3px;margin-left:1px;font-variant-numeric:tabular-nums;white-space:nowrap;"></div>
      `;
      container.appendChild(box);

      const values = box.querySelector(".countdown-values") as HTMLElement;
      const startedAt = Date.now();
      const duration = 3 * 60 * 60 * 1000;
      const render = () => {
        const remaining = Math.max(0, duration - (Date.now() - startedAt));
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        const unit = (value: number, label: string) => `<span style="display:flex;flex-direction:column;align-items:center;min-width:24px"><strong class="seed-digit" style="font:800 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a;letter-spacing:-.04em">${String(value).padStart(2,"0")}</strong><small style="font-size:6px;font-weight:800;color:#94a3b8;margin-top:2px;letter-spacing:.04em">${label}</small></span>`;
        values.innerHTML = `${unit(h,"ঘণ্টা")}<b style="font:900 13px/1;color:#cbd5e1;margin-bottom:8px">:</b>${unit(m,"মিনিট")}<b style="font:900 13px/1;color:#cbd5e1;margin-bottom:8px">:</b>${unit(s,"সেকেন্ড")}`;
      };
      render();
      countdownTimer = setInterval(render, 1000);
    };

    const attach = () => {
      if (enabled) {
        const popup = document.querySelector('.fixed.inset-0.z-\\[60\\]');
        if (popup && popup !== activePopup) {
          activePopup = popup;
          if (timer) clearTimeout(timer);
          timer = setTimeout(closePopup, 10_000);
        }
      }
      removeReviews();
      moveCountdownToHeader();
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleDocumentClick = (event: MouseEvent) => {
      if (!event.isTrusted || !activePopup || !document.body.contains(activePopup)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !activePopup.contains(target)) return;
      const clickedButton = target.closest("button");
      if (!clickedButton) return;
      const isCloseButton = clickedButton.matches('button[aria-label="বন্ধ করুন"], button[aria-label="close"]');
      if (isCloseButton) return;
      event.preventDefault();
      event.stopPropagation();
      closePopup();
    };

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      if (timer) clearTimeout(timer);
      if (countdownTimer) clearInterval(countdownTimer);
      activePopup = null;
    };
  }, [enabled, hideReviews]);

  return null;
}

function LandingPage() {
  const { slug } = useParams({ from: "/landing/$slug" });
  const isLegacySlug = LEGACY_SLUGS.has(slug);
  const { data, isLoading } = useQuery({
    enabled: !isLegacySlug,
    staleTime: 5 * 60_000,
    queryKey: ["landing-template", slug],
    queryFn: async () =>
      (await supabase.from("landing_pages").select("planting_steps").eq("slug", slug).maybeSingle()).data ?? null,
  });

  const popupBehaviorEnabled = slug === "seedcombo" || slug === "seeds-combo-24";
  const hideReviews = slug === "seedcombo";

  if (isLegacySlug) {
    return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} /><LegacyLandingPage slug={slug} /></>;
  }
  if (isLoading) return <BrandLoader />;
  const template = mergeContent(data?.planting_steps).template;
  if (template === "all") {
    return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} /><LegacyLandingPage slug={slug} /></>;
  }
  return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} /><CleanLandingPage slug={slug} /></>;
}
