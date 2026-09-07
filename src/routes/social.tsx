import "@/lib/crypto-polyfill";
import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { CommunityFeedStable } from "@/components/community/CommunityFeedStable";

export const Route = createFileRoute("/social")({
  ssr: false,
  component: SocialPage,
  pendingMs: 0,
  pendingComponent: () => (
    <SiteLayout>
      <CommunitySkeleton />
    </SiteLayout>
  ),
  head: () => ({
    meta: [
      { title: "কমিউনিটি ফিড — Sheikh Seeds" },
      { name: "description", content: "Sheikh Seeds-এর বাগানিদের কমিউনিটি ফিড।" },
    ],
  }),
});

function CommunitySkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-4">
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 w-16 shrink-0 animate-pulse rounded-2xl bg-muted/70" />
        ))}
      </div>
      <div className="mt-4 h-14 animate-pulse rounded-2xl border bg-muted/50" />
      <div className="mt-4 space-y-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="overflow-hidden rounded-2xl border bg-background p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <div className="flex-1">
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-muted/70" />
              </div>
            </div>
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted/70" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted/60" />
            <div className="mt-3 h-48 animate-pulse rounded-xl bg-muted/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialPage() {
  return <SiteLayout><CommunityFeedStable /></SiteLayout>;
}
