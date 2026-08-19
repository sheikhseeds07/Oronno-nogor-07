import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      },
    },
  });

  // Keep admin order screens cached between navigation and only refetch the
  // currently visible order query when an explicit invalidation occurs.
  // This avoids making every admin interaction trigger network requests for
  // inactive order tabs while preserving fast updates for the active screen.
  for (const key of ["admin-orders", "admin-orders-incomplete"] as const) {
    queryClient.setQueryDefaults([key], {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    });
  }

  const baseInvalidateQueries = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = ((filters?: Parameters<typeof baseInvalidateQueries>[0], options?: Parameters<typeof baseInvalidateQueries>[1]) => {
    const firstKey = Array.isArray(filters?.queryKey) ? filters?.queryKey?.[0] : undefined;
    if (firstKey === "admin-orders" || firstKey === "admin-orders-incomplete") {
      // Refetch active queries only. Inactive tabs remain cached and are
      // refreshed naturally when their query becomes active/stale.
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
  });

  return router;
};