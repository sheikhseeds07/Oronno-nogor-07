import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
    }
    return id;
  } catch {
    return null;
  }
}

/** Blocks the whole site for a blocked device or blocked customer account. */
export function SiteBlockGate() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const check = useServerFn(getSiteBlockStatus);

  useEffect(() => {
    setDeviceId(readDeviceId());
    supabase.auth.getSession().then(({ data }) => setCustomerId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setCustomerId(session?.user?.id ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data } = useQuery({
    queryKey: ["site-block-gate", deviceId, customerId],
    enabled: !!deviceId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: () => check({ data: { deviceId, customerId } }),
  });

  if (!data?.blocked) return null;
  return <BlockedNotice />;
}
