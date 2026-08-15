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
      popup?.querySelector<HTMLButtonElement>('button[aria-label="বন্ধ করুন"], button[aria-label="close"]')?.click();
    };
    const removeReviews = () => {
      if (!hideReviews) return;
      const markers = ["কাস্টমার রিভিউ", "কাস্টমার ফিডব্যাক", "ক্রেতারা যা বলছেন", "সন্তুষ্ট কাস্টমারদের মতামত", "রাশেদুল ইসলাম", "সুমাইয়া আক্তার", "মাহবুব হাসান"];
      for (const section of document.querySelectorAll("section")) {
        const text = section.textContent?.trim() || "";
        if (markers.some((marker) => text.includes(marker))) section.remove();
      }
    };
    const hideOrderTexts = () => {
      if (!hideReviews) return;
      const exactTexts = new Set([
        "ধাপ ২",
        "ডেলিভারি তথ্য দিন",
        "নিশ্চিন্তে অর্ডার করুন। অর্ডার করার পরে আমরা আপনাকে কল দিয়ে বিস্তারিত বলে কনফার্ম করবো।",
      ]);
      for (const el of document.querySelectorAll("div, p, h2, h3")) {
        const text = el.textContent?.trim() || "";
        if (exactTexts.has(text)) el.setAttribute("data-seedcombo-hidden-copy", "true");
      }
      for (const el of document.querySelectorAll("[data-seedcombo-hidden-copy]")) {
        (el as HTMLElement).style.visibility = "hidden";
      }
    };
    const moveCountdownToHeader = () => {
      if (!enabled || document.querySelector("[data-seedcombo-header-countdown]")) return;
      const header = document.querySelector("header") as HTMLElement | null;
      if (!header) return;
      const heading = Array.from(document.querySelectorAll("h2,h3,div")).find((el) => el.textContent?.trim() === "অফারটি শেষ হতে আর মাত্র...");
      const section = heading?.closest("section") as HTMLElement | null;
      if (!section) return;
      const orderButton = Array.from(header.querySelectorAll("button")).find((button) => /অর্ডার/.test(button.textContent || "")) as HTMLButtonElement | undefined;
      if (!orderButton) return;
      orderButton.style.display = "none";
      section.style.display = "none";
      const container = header.querySelector(".container") as HTMLElement | null;
      if (!container) return;
      container.style.display = "flex";
      container.style.alignItems = "center";
      container.style.justifyContent = "space-between";
      container.style.gap = "10px";
      const box = document.createElement("div");
      box.dataset.seedcomboHeaderCountdown = "1";
      box.setAttribute("role", "timer");
      box.style.cssText = "position:relative;overflow:hidden;flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:7px 9px;border:1px solid rgba(220,38,38,.16);border-radius:14px;background:linear-gradient(135deg,#fff,#fff7f7);box-shadow:0 8px 24px rgba(15,23,42,.08);";
      box.innerHTML = `<div style="font-size:8px;font-weight:900;color:#dc2626;white-space:nowrap">🔥 অফার শেষ হচ্ছে</div><div class="countdown-values" style="display:flex;align-items:flex-end;gap:3px;font-variant-numeric:tabular-nums;white-space:nowrap"></div>`;
      container.appendChild(box);
      const values = box.querySelector(".countdown-values") as HTMLElement;
      const startedAt = Date.now(), duration = 3 * 60 * 60 * 1000;
      const render = () => {
        const remaining = Math.max(0, duration - (Date.now() - startedAt));
        const h = Math.floor(remaining / 3600000), m = Math.floor((remaining % 3600000) / 60000), s = Math.floor((remaining % 60000) / 1000);
        const unit = (v: number, l: string) => `<span style="display:flex;flex-direction:column;align-items:center;min-width:24px"><strong style="font:800 15px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a">${String(v).padStart(2,"0")}</strong><small style="font-size:6px;font-weight:800;color:#94a3b8;margin-top:2px">${l}</small></span>`;
        values.innerHTML = `${unit(h,"ঘণ্টা")}<b style="color:#cbd5e1">:</b>${unit(m,"মিনিট")}<b style="color:#cbd5e1">:</b>${unit(s,"সেকেন্ড")}`;
      };
      render();
      countdownTimer = setInterval(render, 1000);
    };
    const attach = () => {
      if (enabled) {
        const popup = document.querySelector('.fixed.inset-0.z-\\[60\\]');
        if (popup && popup !== activePopup) { activePopup = popup; if (timer) clearTimeout(timer); timer = setTimeout(closePopup, 10000); }
      }
      removeReviews();
      hideOrderTexts();
      moveCountdownToHeader();
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    const handlePopupCta = (event: MouseEvent) => {
      if (!activePopup || !document.body.contains(activePopup)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !activePopup.contains(target)) return;
      const control = target.closest("button, a") as HTMLElement | null;
      if (!control) return;
      const label = (control.textContent || "").trim();
      const isClose = control.matches('button[aria-label="বন্ধ করুন"], button[aria-label="close"]');
      if (isClose) return;
      if (/এখনই অর্ডার করুন|অর্ডার করুন/.test(label)) {
        event.preventDefault();
        event.stopPropagation();
        closePopup();
      }
    };
    document.addEventListener("click", handlePopupCta, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handlePopupCta, true);
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
    gcTime: 30 * 60_000,
    queryKey: ["landing-template", slug],
    queryFn: async () => (await supabase.from("landing_pages").select("planting_steps").eq("slug", slug).maybeSingle()).data ?? null,
  });
  const popupBehaviorEnabled = slug === "seedcombo" || slug === "seeds-combo-24";
  const hideReviews = slug === "seedcombo";
  if (isLegacySlug) return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} /><LegacyLandingPage slug={slug} /></>;
  const template = mergeContent(data?.planting_steps).template;
  if (isLoading && !data) return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} /><CleanLandingPage slug={slug} /></>;
  if (template === "all") return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} /><LegacyLandingPage slug={slug} /></>;
  return <><LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} /><CleanLandingPage slug={slug} /></>;
}