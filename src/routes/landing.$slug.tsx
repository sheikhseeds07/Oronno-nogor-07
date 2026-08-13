import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/personal-supabase/client";
import { LegacyLandingPage } from "@/components/landing/LegacyLandingPage";
import { CleanLandingPage } from "@/components/landing/CleanLandingPage";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { mergeContent } from "@/lib/landing-content";

// Pages created before templates existed keep the "All product" look.
const LEGACY_SLUGS = new Set(["seeds-combo-24"]);

export const Route = createFileRoute("/landing/$slug")({ component: LandingPage });

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

  if (isLegacySlug) return <LegacyLandingPage slug={slug} />;
  if (isLoading) return <BrandLoader />;

  const template = mergeContent(data?.planting_steps).template;
  if (template === "all") return <LegacyLandingPage slug={slug} />;
  return <CleanLandingPage slug={slug} />;
}
