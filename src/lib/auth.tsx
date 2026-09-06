import { useEffect, useState } from "react";
import { staffSupabase, customerSupabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type StaffRole = "super_admin" | "admin" | "employee" | null;
export type Permissions = { orders: boolean; web_orders: boolean; new_order: boolean; products: boolean; categories: boolean; customers: boolean; marketing: boolean; delivery: boolean; reports: boolean; hrm: boolean; settings: boolean; landing_pages: boolean; all_api: boolean; messages: boolean; dashboard: boolean; dashboard_live_visitors: boolean; dashboard_web_orders: boolean; dashboard_incomplete_orders: boolean; dashboard_stock_alert: boolean; dashboard_confirmed_sell: boolean; dashboard_meta_ads: boolean; dashboard_time_filter: boolean };
export const ALL_TRUE: Permissions = { orders: true, web_orders: true, new_order: true, products: true, categories: true, customers: true, marketing: true, delivery: true, reports: true, hrm: true, settings: true, landing_pages: true, all_api: true, messages: true, dashboard: true, dashboard_live_visitors: true, dashboard_web_orders: true, dashboard_incomplete_orders: true, dashboard_stock_alert: true, dashboard_confirmed_sell: true, dashboard_meta_ads: true, dashboard_time_filter: true };
const ALL_FALSE: Permissions = Object.fromEntries(Object.keys(ALL_TRUE).map(k => [k, false])) as Permissions;

type AuthSnapshot = { session: Session | null; user: Session["user"] | null; role: StaffRole; permissions: Permissions; loading: boolean; initialized: boolean };
const staffState: AuthSnapshot = { session: null, user: null, role: null, permissions: ALL_FALSE, loading: true, initialized: false };
const customerState: AuthSnapshot = { session: null, user: null, role: null, permissions: ALL_FALSE, loading: true, initialized: false };
const listeners = new Set<() => void>();
let bootstrapped = false;
let staffLoadSeq = 0;

function notify() { listeners.forEach(l => l()); }
function setStaff(p: Partial<AuthSnapshot>) { Object.assign(staffState, p); notify(); }
function setCustomer(p: Partial<AuthSnapshot>) { Object.assign(customerState, p); notify(); }

const readPerms = (p: any): Permissions => ({ orders: !!p.orders, web_orders: !!p.web_orders, new_order: !!p.new_order, products: !!p.products, categories: !!p.categories, customers: !!p.customers, marketing: !!p.marketing, delivery: !!p.delivery, reports: !!p.reports, hrm: !!p.hrm, settings: !!p.settings, landing_pages: !!p.landing_pages, all_api: !!p.all_api, messages: !!p.messages, dashboard: p.dashboard !== false, dashboard_live_visitors: p.dashboard_live_visitors !== false, dashboard_web_orders: p.dashboard_web_orders !== false, dashboard_incomplete_orders: p.dashboard_incomplete_orders !== false, dashboard_stock_alert: p.dashboard_stock_alert !== false, dashboard_confirmed_sell: p.dashboard_confirmed_sell !== false, dashboard_meta_ads: p.dashboard_meta_ads !== false, dashboard_time_filter: p.dashboard_time_filter !== false });

function isStaffRoute() {
  if (typeof window === "undefined") return true;
  const path = window.location.pathname;
  return path === "/login" || path === "/admin" || path.startsWith("/admin/");
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (error) {
      lastError = error;
      if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, 250 * (i + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

async function loadStaff(s: Session | null, force = false) {
  const seq = ++staffLoadSeq;
  const previousUserId = staffState.user?.id ?? null;

  if (!s?.user) {
    try { window.localStorage.removeItem("ss_auth_cache_v1"); } catch {}
    setStaff({ session: null, user: null, role: null, permissions: ALL_FALSE, loading: false, initialized: true });
    return;
  }

  // TOKEN_REFRESHED happens frequently. Do not refetch roles/permissions for the
  // same user; only replace the session token so protected requests use the fresh token.
  if (!force && staffState.initialized && previousUserId === s.user.id) {
    if (seq === staffLoadSeq) setStaff({ session: s, user: s.user, loading: false });
    return;
  }

  const sameUser = previousUserId === s.user.id;
  setStaff({ session: s, user: s.user, loading: true, ...(sameUser ? {} : { role: null, permissions: ALL_FALSE }) });

  try {
    const { data: roles, error: roleError } = await withRetry(async () => {
      const result = await staffSupabase.from("user_roles").select("role").eq("user_id", s.user.id);
      if (result.error) throw result.error;
      return result;
    });
    if (seq !== staffLoadSeq) return;

    const list = (roles ?? []).map(x => x.role as string);
    const meta = (s.user.app_metadata?.role ?? s.user.app_metadata?.app_role) as string | undefined;
    let role: StaffRole = null;
    if (list.includes("super_admin") || meta === "super_admin") role = "super_admin";
    else if (list.includes("admin") || meta === "admin") role = "admin";
    else if (list.includes("employee")) role = "employee";

    let permissions = ALL_FALSE;
    if (role) {
      const { data: p } = await withRetry(async () => {
        const result = await staffSupabase.from("employee_permissions").select("*").eq("user_id", s.user.id).maybeSingle();
        if (result.error) throw result.error;
        return result;
      });
      if (seq !== staffLoadSeq) return;
      permissions = p ? readPerms(p) : ALL_TRUE;
    }

    try { window.localStorage.setItem("ss_auth_cache_v1", JSON.stringify({ role, permissions, user_id: s.user.id })); } catch {}
    if (seq !== staffLoadSeq) return;
    setStaff({ session: s, user: s.user, role, permissions, loading: false, initialized: true });
  } catch {
    // Never let a transient profile/permission request erase a valid session.
    // Keep the last known authorization only when it belongs to this same user.
    if (seq !== staffLoadSeq) return;
    setStaff({ session: s, user: s.user, loading: false, initialized: true, ...(sameUser ? {} : { role: null, permissions: ALL_FALSE }) });
  }
}

async function loadCustomer(s: Session | null) {
  setCustomer({ session: s, user: s?.user ?? null, role: null, permissions: ALL_FALSE, loading: false, initialized: true });
}

function bootstrap() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;

  staffSupabase.auth.onAuthStateChange((event, s) => {
    if (event === "TOKEN_REFRESHED") {
      void loadStaff(s, false);
      return;
    }
    void loadStaff(s, true);
  });
  customerSupabase.auth.onAuthStateChange((_event, s) => { void loadCustomer(s); });

  void staffSupabase.auth.getSession().then(({ data: { session } }) => loadStaff(session, true));
  void customerSupabase.auth.getSession().then(({ data: { session } }) => loadCustomer(session));
}

function hideIncompleteForEmployee(role: StaffRole) {
  if (typeof document === "undefined") return;
  const apply = () => {
    if (role !== "employee") return;
    document.querySelectorAll("button").forEach(el => {
      const text = (el.textContent || "").trim().toLowerCase();
      if (text.startsWith("incomplete")) (el as HTMLElement).style.display = "none";
    });
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

export function useAuth() {
  bootstrap();
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force(v => v + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const customerMode = !isStaffRoute();
  const snap = customerMode ? customerState : staffState;
  useEffect(() => hideIncompleteForEmployee(staffState.role), [staffState.role]);

  const isAdmin = !customerMode && (snap.role === "admin" || snap.role === "super_admin");
  return {
    session: snap.session,
    user: snap.user,
    role: snap.role,
    isAdmin,
    isStaff: !customerMode && (isAdmin || snap.role === "employee"),
    permissions: snap.permissions,
    loading: snap.loading && !snap.initialized,
    initialized: snap.initialized,
  };
}
