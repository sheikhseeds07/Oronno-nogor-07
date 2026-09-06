import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const isRetryableQueryError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  if (/401|403|unauthorized|forbidden|invalid token|permission denied|validation|not found/.test(message)) return false;
  return true;
};

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        retry: (failureCount, error) => failureCount < 2 && isRetryableQueryError(error),
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 4000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
      },
    },
  });

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
    dehydrate: () => ({ queryClientState: dehydrate(queryClient) }),
    hydrate: (dehydrated) => {
      hydrate(queryClient, dehydrated.queryClientState);
    },
  });

  return router;
};
