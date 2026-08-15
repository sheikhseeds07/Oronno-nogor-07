import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { LegacyLandingPage } from "@/components/landing/LegacyLandingPage";
import { CleanLandingPage } from "@/components/landing/CleanLandingPage";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { mergeContent } from "@/lib/landing-content";

// Pages created before templates existed keep the "All product" look.
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
      const closeButton = popup.querySelector<HTMLButtonElement>(
        'button[aria-label="বন্ধ করুন"], button[aria-label="close"]',
      );
      closeButton?.click();
    };

    const removeReviews = () => {
      if (!hideReviews) return;
      const reviewMarkers = [
        "কাস্টমার রিভিউ",
        "কাস্টমার ফিডব্যাক",
        "ক্রেতারা যা বলছেন",
        "সন্তুষ্ট কাস্টমারদের মতামত",
        "রাশেদুল ইসলাম",
        "সুমাইয়া আক্তার",
        "মাহবুব হাসান",
      ];
      for (const section of document.querySelectorAll("section")) {
        const text = section.textContent?.trim() || "";
        if (reviewMarkers.some((marker) => text.includes(marker))) section.remove();
      }
    };

    const moveCountdownToHeader = () => {
      if (!enabled || document.querySelector("[data-seedcombo-header-countdown]")) return;
      const header = document.querySelector("header") as HTMLElement | null;
      if (!header) return;

      const heading = Array.from(document.querySelectorAll("h2, h3, div"))
        .find((el) => el.textContent?.trim() === "অফারটি শেষ হতে আর মাত্র...");
      const section = heading?.closest("section") as HTMLElement | null;
      if (!section) return;

      const orderButton = Array.from(header.querySelectorAll("button"))
        .find((button) => /অর্ডার/.test(button.textContent || "")) as HTMLButtonElement | undefined;
      if (!orderButton) return;

      orderButton.style.display = "none";
      section.style.display = "none";

      const box = document.createElement("div");
      box.dataset.seedcomboHeaderCountdown = "1";
      box.className = "ml-auto flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 shadow-sm max-w-[245px]";
      box.innerHTML = `
        <div class="leading-tight text-right min-w-0">
          <div class="text-[9px] font-extrabold uppercase tracking-wide text-red-600">🔥 অফার শেষ হচ্ছে</div>
          <div class="text-[10px] font-semibold text-slate-600 whitespace-nowrap">সময় ফুরিয়ে যাওয়ার আগেই অর্ডার করুন</div>
        </div>
        <div class="countdown-values flex items-center gap-1 font-mono font-black text-red-700 text-[16px] whitespace-nowrap"></div>
      `;
      const container = header.querySelector(".container");
      (container || header).appendChild(box);

      const values = box.querySelector(".countdown-values") as HTMLElement;
      const startedAt = Date.now();
      const duration = 3 * 60 * 60 * 1000;
      const render = () => {
        const remaining = Math.max(0, duration - (Date.now() - startedAt));
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        values.innerHTML = `<span>${String(h).padStart(2, "0")}</span><b>:</b><span>${String(m).padStart(2, "0")}</span><b>:</b><span>${String(s).padStart(2, "0")}</span>`;
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
    return (
      <>
        <LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} />
        <LegacyLandingPage slug={slug} />
      </>
    );
  }
  if (isLoading) return <BrandLoader />;

  const template = mergeContent(data?.planting_steps).template;
  if (template === "all") {
    return (
      <>
        <LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} />
        <LegacyLandingPage slug={slug} />
      </>
    );
  }

  return (
    <>
      <LandingPopupBehavior enabled={popupBehaviorEnabled} hideReviews={hideReviews} />
      <CleanLandingPage slug={slug} />
    </>
  );
}
