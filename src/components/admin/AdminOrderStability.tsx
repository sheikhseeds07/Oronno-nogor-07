import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/personal-supabase/client";

const WEB_STATUSES = new Set(["web_pending", "hold", "cancelled"]);
const LIST_STATUSES = new Set([
  "pending",
  "rts",
  "shipped",
  "delivered",
  "pending_return",
  "returned",
  "partial",
  "cancelled",
]);

function belongsToList(mode: string, filter: string, status: string) {
  if (mode === "web") {
    return filter === "all" ? WEB_STATUSES.has(status) : filter === status;
  }
  if (mode === "list") {
    return filter === "all" ? LIST_STATUSES.has(status) : filter === status;
  }
  return false;
}

/**
 * Keep the currently visible Orders table stable while realtime changes arrive.
 * UPDATE/DELETE events patch/remove existing cached rows in place instead of
 * triggering a background refetch that collapses the table and changes scroll.
 * INSERT is intentionally ignored: NewOrderNotifier alerts staff, while their
 * current working list/scroll stays untouched until they change tab/status.
 */
export function AdminOrderStability() {
  const qc = useQueryClient();

  useEffect(() => {
    const applyChange = (payload: any) => {
      const id = payload?.new?.id ?? payload?.old?.id;
      if (!id) return;

      const isDelete = payload.eventType === "DELETE";
      const status = payload?.new?.status as string | undefined;
      const queries = qc.getQueryCache().findAll({ queryKey: ["admin-orders"] });

      for (const query of queries) {
        const key = query.queryKey;
        const mode = String(key[1] ?? "");
        const filter = String(key[2] ?? "");
        if (!Array.isArray(query.state.data)) continue;

        qc.setQueryData(key, (current: any[] | undefined) => {
          if (!current) return current;

          if (isDelete || !status || !belongsToList(mode, filter, status)) {
            return current.filter((row) => row?.id !== id);
          }

          return current.map((row) =>
            row?.id === id ? { ...row, status, updated_at: payload?.new?.updated_at ?? row.updated_at } : row,
          );
        });
      }
    };

    const channel = supabase
      .channel("admin-orders-stable-cache")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, applyChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, applyChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return null;
}