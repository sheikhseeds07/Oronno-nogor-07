import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { SocialFeedProV2 } from "@/components/community/SocialFeedProV2";

export const Route = createFileRoute("/social")({
  component: SocialPage,
  head: () => ({
    meta: [
      { title: "কমিউনিটি ফিড — Sheikh Seeds" },
      { name: "description", content: "Sheikh Seeds-এর বাগানিদের কমিউনিটি ফিড।" },
    ],
  }),
});

function SocialPage() {
  return <SiteLayout><SocialFeedProV2 /></SiteLayout>;
}
