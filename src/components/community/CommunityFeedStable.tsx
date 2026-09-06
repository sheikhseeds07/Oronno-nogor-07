import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SocialFeedProV2 } from "./SocialFeedProV2";

type CacheShape = { posts?: unknown[]; stories?: unknown[]; savedAt?: number };
const KEY = "sheikh-seeds-community-cache-v1";

function readCache(): CacheShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheShape;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function CommunityFeedStable() {
  const qc = useQueryClient();
  const hydrated = useRef(false);
  const [ready, setReady] = useState(false);

  if (!hydrated.current) {
    hydrated.current = true;
    const cache = readCache();
    if (cache.posts) qc.setQueryData(["community-posts"], cache.posts);
    if (cache.stories) qc.setQueryData(["community-stories"], cache.stories);
    setReady(true);
  }

  useEffect(() => {
    const save = () => {
      try {
        const posts = qc.getQueryData<unknown[]>(["community-posts"]);
        const stories = qc.getQueryData<unknown[]>(["community-stories"]);
        if (posts || stories) {
          localStorage.setItem(KEY, JSON.stringify({ posts, stories, savedAt: Date.now() }));
        }
      } catch {}
    };

    const unsub = qc.getQueryCache().subscribe(event => {
      const key = event?.query?.queryKey?.[0];
      if (key === "community-posts" || key === "community-stories") save();
    });
    return unsub;
  }, [qc]);

  if (!ready) return null;
  return <SocialFeedProV2 />;
}
