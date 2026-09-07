import "@/lib/crypto-polyfill";
import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { CommunityFeedStable } from "@/components/community/CommunityFeedStable";

export const Route = createFileRoute("/social")({
  ssr: false,
  component: SocialPage,
  head: () => ({
    meta: [
      { title: "কমিউনিটি ফিড — Sheikh Seeds" },
      { name: "description", content: "Sheikh Seeds-এর বাগানিদের কমিউনিটি ফিড।" },
    ],
  }),
});

function SocialPage() {
  return <SiteLayout><CommunityFeedStable /></SiteLayout>;
}
