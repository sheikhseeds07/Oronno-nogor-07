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

      // The seedcombo page has existed in multiple landing templates, so do
      // not rely on one exact heading. Remove the whole review section when
      // any of its known review labels/content is rendered.
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
        if (reviewMarkers.some((marker) => text.includes(marker))) {
          section.remove();
        }
      }
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

      const isCloseButton = clickedButton.matches(
        'button[aria-label="বন্ধ করুন"], button[aria-label="close"]',
      );
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
