import { useEffect, useRef, useState } from "react";
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

function invoiceSequence(value: unknown) {
  const match = String(value ?? "").match(/(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortInvoiceQueue(rows: any[]) {
  return [...rows].sort((a, b) => {
    const diff = invoiceSequence(a?.invoice_no) - invoiceSequence(b?.invoice_no);
    if (diff !== 0) return diff;
    const text = String(a?.invoice_no ?? "").localeCompare(String(b?.invoice_no ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (text !== 0) return text;
    return String(a?.created_at ?? "").localeCompare(String(b?.created_at ?? ""));
  });
}

const SCROLL_STORAGE_KEY = "admin-orders-scroll-y";
const ORDER_STABLE_QUERY_KEYS = [
  "admin-orders",
  "admin-orders-incomplete",
  "order-status-counts",
  "incomplete-count",
  "order-search",
  "order-detail",
] as const;

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
  const savedScrollY = useRef(0);
  const restoreTimers = useRef<number[]>([]);

  // Defense-in-depth: even if another order component requests an invalidation,
  // switching browser tabs must never trigger a focus/reconnect/mount refetch of
  // the active order table. Explicit actions and realtime cache patches remain.
  useEffect(() => {
    for (const key of ORDER_STABLE_QUERY_KEYS) {
      qc.setQueryDefaults([key], {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      });
    }
    qc.setQueryDefaults(["order-locks"], {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      refetchIntervalInBackground: false,
    });
  }, [qc]);

  // Pending and RTS are operational queues and must always be displayed by
  // invoice sequence (AA100, AA101, AA102...), not by created_at. The Orders
  // page still fetches normally; this cache guard only normalizes the two queue
  // views and leaves every other status/courier flow untouched.
  useEffect(() => {
    if (location.pathname !== "/admin/orders") return;

    let applying = false;
    const normalize = (query: any) => {
      if (applying || !query) return;
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== "admin-orders" || key[1] !== "list") return;
      const filter = String(key[2] ?? "");
      if (filter !== "pending" && filter !== "rts") return;
      const current = query.state?.data;
      if (!Array.isArray(current) || current.length < 2) return;

      const sorted = sortInvoiceQueue(current);
      const changed = sorted.some((row, index) => row?.id !== current[index]?.id);
      if (!changed) return;

      applying = true;
      try {
        qc.setQueryData(key, sorted);
      } finally {
        applying = false;
      }
    };

    for (const query of qc.getQueryCache().findAll({ queryKey: ["admin-orders"] })) normalize(query);
    const unsubscribe = qc.getQueryCache().subscribe((event) => normalize(event?.query));
    return unsubscribe;
  }, [qc, location.pathname]);

  // Save only the last known visible position. While the browser tab is hidden,
  // some browsers can emit a scroll=0 event during tab suspension; that must
  // never overwrite the operator's real working position.
  useEffect(() => {
    if (location.pathname !== "/admin/orders") return;

    const readStored = () => {
      try {
        const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
        if (raw !== null) {
          const y = Number(raw);
          if (Number.isFinite(y) && y >= 0) savedScrollY.current = y;
        }
      } catch {
        // sessionStorage may be unavailable in some privacy modes.
      }
    };

    const capture = () => {
      if (document.hidden) return;
      const y = window.scrollY;
      savedScrollY.current = y;
      try { sessionStorage.setItem(SCROLL_STORAGE_KEY, String(y)); } catch { /* ignore */ }
    };

    // Restore repeatedly because a tab can be resumed/reloaded before the order
    // rows have been painted. A single requestAnimationFrame can run while the
    // document is still short, causing scrollTo() to clamp to 0 permanently.
    const restore = () => {
      readStored();
      for (const timer of restoreTimers.current) {
        window.clearTimeout(timer);
      }
      restoreTimers.current = [];

      const y = savedScrollY.current;
      const apply = () => {
        if (document.hidden || location.pathname !== "/admin/orders") return;
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        if (y <= maxScroll + 8) {
          window.scrollTo({ top: y, behavior: "auto" });
        }
      };

      apply();
      requestAnimationFrame(apply);
      requestAnimationFrame(() => requestAnimationFrame(apply));
      restoreTimers.current = [50, 150, 300, 600, 1000].map((delay) =>
        window.setTimeout(apply, delay),
      );
    };

    const saveBeforePageHide = () => {
      // Scroll events while visible already persist the exact position.
      if (!document.hidden) capture();
    };
    const restoreAfterPageShow = () => restore();

    readStored();
    window.addEventListener("scroll", capture, { passive: true });

    const onVisibility = () => {
      if (!document.hidden) restore();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", saveBeforePageHide);
    window.addEventListener("pageshow", restoreAfterPageShow);

    // Same-page order/detail navigation and remounts must keep the exact position.
    restore();

    return () => {
      window.removeEventListener("scroll", capture);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", saveBeforePageHide);
      window.removeEventListener("pageshow", restoreAfterPageShow);
      for (const timer of restoreTimers.current) window.clearTimeout(timer);
      restoreTimers.current = [];
    };
  }, [location.pathname, location.search]);

  // Capture the position BEFORE any order/detail button action. This runs in the
  // capture phase so it happens before the router can reset scroll for navigation.
  useEffect(() => {
    if (location.pathname !== "/admin/orders") return;

    const remember = () => {
      if (document.hidden) return;
      const y = window.scrollY;
      savedScrollY.current = y;
      try { sessionStorage.setItem(SCROLL_STORAGE_KEY, String(y)); } catch { /* ignore */ }
    };

    const restoreAfterAction = () => {
      const y = savedScrollY.current;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (location.pathname === "/admin/orders") {
            window.scrollTo({ top: y, behavior: "auto" });
          }
        });
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("button,select,[role='button']")) return;
      remember();
      restoreAfterAction();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [location.pathname]);

  useEffect(() => {
    const applyOrderChange = (payload: any) => {
      const id = payload?.new?.id ?? payload?.old?.id;
      if (!id) return;

      const isDelete = payload.eventType === "DELETE";
      const status = payload?.new?.status as string | undefined;
      const queries = qc.getQueryCache().findAll({ queryKey: ["admin-orders"] });
      const y = window.scrollY;
      if (!document.hidden) {
        savedScrollY.current = y;
        try { sessionStorage.setItem(SCROLL_STORAGE_KEY, String(y)); } catch { /* ignore */ }
      }

      for (const query of queries) {
        const key = query.queryKey;
        const mode = String(key[1] ?? "");
        const filter = String(key[2] ?? "");
        const cached = query.state.data;
        if (!cached) continue;

        // OrdersPage is { rows, total }, not a bare array. Patch the actual
        // cache shape so Realtime can update the table without a refetch.
        qc.setQueryData(key, (current: any) => {
          if (!current) return current;
          const rows = Array.isArray(current) ? current : current.rows;
          if (!Array.isArray(rows)) return current;

          if (isDelete || !status || !belongsToList(mode, filter, status)) {
            const nextRows = rows.filter((row: any) => row?.id !== id);
            if (Array.isArray(current)) return nextRows;
            return nextRows.length === rows.length
              ? current
              : { ...current, rows: nextRows, total: Math.max(0, Number(current.total ?? rows.length) - 1) };
          }

          const nextRows = rows.map((row: any) =>
            row?.id === id
              ? { ...row, status, updated_at: payload?.new?.updated_at ?? row.updated_at }
              : row,
          );
          const finalRows = mode === "list" && (filter === "pending" || filter === "rts")
            ? sortInvoiceQueue(nextRows)
            : nextRows;
          return Array.isArray(current) ? finalRows : { ...current, rows: finalRows };
        });
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!document.hidden && location.pathname === "/admin/orders") {
            window.scrollTo({ top: y, behavior: "auto" });
          }
        });
      });
    };

    const applyIncompleteChange = (payload: any) => {
      const rawId = payload?.new?.id ?? payload?.old?.id;
      if (!rawId) return;
      const id = `inc:${rawId}`;
      const y = window.scrollY;
      if (!document.hidden) {
        savedScrollY.current = y;
        try { sessionStorage.setItem(SCROLL_STORAGE_KEY, String(y)); } catch { /* ignore */ }
      }

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

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!document.hidden && location.pathname === "/admin/orders") {
            window.scrollTo({ top: y, behavior: "auto" });
          }
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
  }, [qc, location.pathname]);

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
