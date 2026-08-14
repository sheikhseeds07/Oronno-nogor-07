import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000, // 5 minutes default stale time
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      },
    },
  });

  // Orders are high-interaction screens. Realtime events and explicit mutations
  // used to invalidate the active list, which made the table replace its rows
  // with a loader and collapsed the page height (jumping the admin back to top).
  // Mark active order lists stale without immediately refetching them. The
  // realtime cache synchronizer removes/moves changed rows in-place, while an
  // internal tab/status remount gets a fresh copy from Supabase.
  queryClient.setQueryDefaults(["admin-orders"], {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: "always",
  });

  const baseInvalidateQueries = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = ((filters?: Parameters<typeof baseInvalidateQueries>[0], options?: Parameters<typeof baseInvalidateQueries>[1]) => {
    const firstKey = Array.isArray(filters?.queryKey) ? filters?.queryKey?.[0] : undefined;
    if (firstKey === "admin-orders") {
      return baseInvalidateQueries({ ...filters, refetchType: "none" }, options);
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
  });

  return router;
};