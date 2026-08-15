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

function LandingPopupBehavior({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

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

    const attach = () => {
      const popup = document.querySelector('.fixed.inset-0.z-\\[60\\]');
      if (!popup || popup === activePopup) return;

      activePopup = popup;
      if (timer) clearTimeout(timer);
      timer = setTimeout(closePopup, 10_000);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      if (activePopup && document.body.contains(activePopup)) closePopup();
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      if (timer) clearTimeout(timer);
      activePopup = null;
    };
  }, [enabled]);

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

  if (isLegacySlug) {
    return (
      <>
        <LandingPopupBehavior enabled={slug === "seedcombo"} />
        <LegacyLandingPage slug={slug} />
      </>
    );
  }
  if (isLoading) return <BrandLoader />;

  const template = mergeContent(data?.planting_steps).template;
  if (template === "all") {
    return (
      <>
        <LandingPopupBehavior enabled={slug === "seedcombo"} />
        <LegacyLandingPage slug={slug} />
      </>
    );
  }

  return (
    <>
      <LandingPopupBehavior enabled={slug === "seedcombo"} />
      <CleanLandingPage slug={slug} />
    </>
  );
}
