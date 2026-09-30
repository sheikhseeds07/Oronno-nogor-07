import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { staffSupabase, customerSupabase } from "@/lib/personal-supabase/client";

const isRetryableQueryError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  if (/401|403|unauthorized|forbidden|invalid token|permission denied|validation|not found/.test(message)) return false;
  return true;
};

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 60_000,
        gcTime: 2 * 60 * 60_000,
        retry: (failureCount, error) => failureCount < 2 && isRetryableQueryError(error),
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 4000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      },
    },
  });

  // Admin pages should feel instant when moving between sections: keep warm cache data
  // on navigation/focus instead of issuing a fresh request just because the route mounted.
  // Realtime/explicit invalidation remains responsible for data that must update immediately.
  queryClient.setQueryDefaults(["admin"], {
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  for (const key of ["admin-orders", "admin-orders-incomplete"] as const) {
    queryClient.setQueryDefaults([key], {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    });
  }

  // Never let a previous staff/customer session reuse user-scoped query data.
  // A new session gets a clean cache, while normal token refreshes keep the cache warm.
  if (typeof window !== "undefined") {
    let staffUserId: string | null = null;
    let customerUserId: string | null = null;
    staffSupabase.auth.getSession().then(({ data }) => { staffUserId = data.session?.user.id ?? null; }).catch(() => undefined);
    customerSupabase.auth.getSession().then(({ data }) => { customerUserId = data.session?.user.id ?? null; }).catch(() => undefined);

    staffSupabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && staffUserId !== nextUserId)) queryClient.clear();
      staffUserId = nextUserId;
    });
    customerSupabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && customerUserId !== nextUserId)) queryClient.clear();
      customerUserId = nextUserId;
    });
  }

  const baseInvalidateQueries = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = ((filters?: Parameters<typeof baseInvalidateQueries>[0], options?: Parameters<typeof baseInvalidateQueries>[1]) => {
    const firstKey = Array.isArray(filters?.queryKey) ? filters?.queryKey?.[0] : undefined;
    if (firstKey === "admin-orders" || firstKey === "admin-orders-incomplete") {
      return baseInvalidateQueries({ ...filters, refetchType: "active" }, options);
    }
    return baseInvalidateQueries(filters, options);
  }) as typeof queryClient.invalidateQueries;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 60_000,
    defaultPreloadGcTime: 5 * 60_000,
    dehydrate: () => ({ queryClientState: dehydrate(queryClient) }) as any,
    hydrate: (dehydrated) => {
      hydrate(queryClient, dehydrated.queryClientState);
    },
  });

  return router;
};
