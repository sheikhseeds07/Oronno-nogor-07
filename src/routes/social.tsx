import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { SocialFeed } from "@/components/community/SocialFeed";

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
  return <SiteLayout><SocialFeed /></SiteLayout>;
}
