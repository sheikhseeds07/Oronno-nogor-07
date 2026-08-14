import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
 * Existing rows are patched/removed in-place instead of starting a background
 * refetch that replaces the table with a loader and changes the scroll position.
 * INSERT is intentionally ignored: NewOrderNotifier still alerts staff, but the
 * list they're actively working on remains untouched until they change view.
 *
 * This component also mounts the Trash shortcut into the order status-filter row
 * so it stays exactly beside the filters instead of in the top admin header.
 */
export function AdminOrderStability() {
  const qc = useQueryClient();
  const location = useLocation();
  const [trashTarget, setTrashTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const applyOrderChange = (payload: any) => {
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
            row?.id === id
              ? { ...row, status, updated_at: payload?.new?.updated_at ?? row.updated_at }
              : row,
          );
        });
      }
    };

    const applyIncompleteChange = (payload: any) => {
      const rawId = payload?.new?.id ?? payload?.old?.id;
      if (!rawId) return;
      const id = `inc:${rawId}`;

      qc.setQueryData(["admin-orders-incomplete"], (current: any[] | undefined) => {
        if (!current) return current;
        if (payload.eventType === "DELETE") {
          return current.filter((row) => row?.id !== id);
        }

        const row = payload?.new;
        if (!row) return current;
        return current.map((existing) => {
          if (existing?.id !== id) return existing;
          return {
            ...existing,
            customer_name: row.customer_name || "—",
            customer_phone: row.phone,
            customer_address: row.customer_address ?? null,
            district: row.delivery_zone ?? null,
            created_at: row.updated_at ?? row.created_at ?? existing.created_at,
            total: Number(row.total ?? 0),
            order_items: (row.items ?? []).map((item: any, index: number) => ({
              id: `${rawId}-${index}`,
              product_name: item.name,
              quantity: Number(item.quantity ?? 1),
              price: Number(item.price ?? 0),
              product_id: item.product_id ?? null,
            })),
          };
        });
      });
    };

    const channel = supabase
      .channel("admin-orders-stable-cache")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, applyOrderChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, applyOrderChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "incomplete_orders" }, applyIncompleteChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "incomplete_orders" }, applyIncompleteChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    if (location.pathname !== "/admin/orders") {
      setTrashTarget(null);
      return;
    }

    const findFilterRow = () => {
      const searchInput = Array.from(document.querySelectorAll<HTMLInputElement>("input"))
        .find((input) => input.placeholder.startsWith("এই স্ট্যাটাসে সার্চ করুন"));
      const row = searchInput?.parentElement?.nextElementSibling;
      if (row instanceof HTMLElement) setTrashTarget(row);
    };

    const frame = window.requestAnimationFrame(findFilterRow);
    const observer = new MutationObserver(findFilterRow);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      setTrashTarget(null);
    };
  }, [location.pathname]);

  if (!trashTarget) return null;

  return createPortal(
    <Link
      to={"/admin/deleted-orders" as any}
      className="ml-auto sticky right-0 z-10 shrink-0 inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-100"
      title="ডিলিটেড অর্ডার / Trash Folder"
    >
      <Trash2 className="h-3.5 w-3.5" />
      ট্র্যাশ
    </Link>,
    trashTarget,
  );
}
