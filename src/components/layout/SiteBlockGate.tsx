import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { getSiteBlockStatus } from "@/lib/visitor-block.functions";
import { supabase } from "@/lib/personal-supabase/client";
import { safeUUID } from "@/lib/uuid";
import { BlockedNotice } from "@/components/layout/BlockedNotice";

const DEVICE_KEY = "hng-device-id";

function readDeviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = safeUUID();
      localStorage.setItem(DEVICE_KEY, id);
      document.cookie = `${DEVICE_KEY}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
    if (id) document.cookie = `${DEVICE_KEY}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    return id;
  } catch {
    return null;
  }
}

/** Blocks the whole site for a blocked IP, blocked device or blocked customer account. */
export function SiteBlockGate() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const check = useServerFn(getSiteBlockStatus);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Admin panel and login stay reachable so blocks can always be managed.
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/login");

  useEffect(() => {
    setDeviceId(readDeviceId());
    setReady(true);
    supabase.auth.getSession().then(({ data }) => setCustomerId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setCustomerId(session?.user?.id ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Re-check on every page change so a block applies to the whole site, not just one page.
  const { data } = useQuery({
    // Block status is security state, but it does not need a request on every\n    // route change or window focus. Reuse the same result across navigation.\n    queryKey: ["site-block-gate", deviceId, customerId],
    enabled: ready && !isAdminArea,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const cacheKey = `site-block-gate:${deviceId ?? "none"}:${customerId ?? "guest"}`;
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw) as { at?: number; blocked?: boolean };
          if (typeof cached.at === "number" && Date.now() - cached.at < 5 * 60_000 && typeof cached.blocked === "boolean") {
            return { blocked: cached.blocked };
          }
        }
      } catch {}
      const result = await check({ data: { deviceId, customerId } });
      try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), blocked: !!result?.blocked })); } catch {}
      return result;
    },
  });

  if (isAdminArea || !data?.blocked) return null;
  return <BlockedNotice />;
}
