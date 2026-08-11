import { createFileRoute, useParams } from "@tanstack/react-router";
import { LegacyLandingPage } from "@/components/landing/LegacyLandingPage";
import { CleanLandingPage } from "@/components/landing/CleanLandingPage";

const LEGACY_SLUGS = new Set(["seeds-combo-24"]);

export const Route = createFileRoute("/landing/$slug")({ component: LandingPage });

function LandingPage() {
  const { slug } = useParams({ from: "/landing/$slug" });
  if (LEGACY_SLUGS.has(slug)) return <LegacyLandingPage slug={slug} />;
  return <CleanLandingPage slug={slug} />;
}
