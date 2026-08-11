import { useEffect, useState } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type StaffRole = "super_admin" | "admin" | "employee" | null;

export type Permissions = {
  orders: boolean;
  web_orders: boolean;
  new_order: boolean;
  products: boolean;
  categories: boolean;
  customers: boolean;
  marketing: boolean;
  delivery: boolean;
  reports: boolean;
  hrm: boolean;
  settings: boolean;
  landing_pages: boolean;
  all_api: boolean;
  messages: boolean;
};

export const ALL_TRUE: Permissions = {
  orders: true, web_orders: true, new_order: true, products: true, categories: true,
  customers: true, marketing: true, delivery: true, reports: true, hrm: true,
  settings: true, landing_pages: true, all_api: true, messages: true,
};

const ALL_FALSE: Permissions = {
  orders: false, web_orders: false, new_order: false, products: false, categories: false,
  customers: false, marketing: false, delivery: false, reports: false, hrm: false,
  settings: false, landing_pages: false, all_api: false, messages: false,
};

type AuthState = {
  session: Session | null;
  user: User | null;
  role: StaffRole;
  permissions: Permissions;
  loading: boolean;
  initialized: boolean;
};

// Module-level singleton so navigating between admin pages doesn't re-flash a loading state.
const listeners = new Set<(s: AuthState) => void>();
let state: AuthState = {
  session: null,
  user: null,
  role: null,
  permissions: ALL_FALSE,
  loading: true,
  initialized: false,
};

// Hydrate cached role/permissions instantly (synchronous) so first paint never shows the spinner.
if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem("ss_auth_cache_v1");
    if (raw) {
      const cached = JSON.parse(raw) as { role: StaffRole; permissions: Permissions };
      if (cached && cached.permissions) {
        state = { ...state, role: cached.role, permissions: cached.permissions, loading: true };
      }
    }
  } catch {}
}

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

let bootstrapped = false;
function bootstrap() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;

  const load = async (s: Session | null) => {
    if (!s?.user) {
      try { window.localStorage.removeItem("ss_auth_cache_v1"); } catch {}
      setState({ session: s, user: null, role: null, permissions: ALL_FALSE, loading: false, initialized: true });
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", s.user.id);
    const list = (roles ?? []).map((r) => r.role as string);
    const meta = (s.user.app_metadata?.role ?? s.user.app_metadata?.app_role) as string | undefined;
    let r: StaffRole = null;
    if (list.includes("super_admin") || meta === "super_admin") r = "super_admin";
    else if (list.includes("admin") || meta === "admin") r = "admin";
    else if (list.includes("employee")) r = "employee";

    let perms: Permissions = ALL_FALSE;
    if (r === "admin" || r === "super_admin") {
      perms = ALL_TRUE;
    } else if (r === "employee") {
      const { data: p } = await supabase
        .from("employee_permissions")
        .select("*")
        .eq("user_id", s.user.id)
        .maybeSingle();
      if (p) {
        perms = {
          orders: !!p.orders, web_orders: !!p.web_orders, new_order: !!p.new_order,
          products: !!p.products, categories: !!p.categories, customers: !!p.customers,
          marketing: !!p.marketing, delivery: !!p.delivery, reports: !!p.reports,
          hrm: !!p.hrm, settings: !!p.settings, landing_pages: !!p.landing_pages,
          all_api: !!p.all_api, messages: !!p.messages,
        };
      }
    }

    try {
      window.localStorage.setItem("ss_auth_cache_v1", JSON.stringify({ role: r, permissions: perms }));
    } catch {}

    setState({ session: s, user: s.user, role: r, permissions: perms, loading: false, initialized: true });
  };

  supabase.auth.onAuthStateChange((_e, s) => { load(s); });
  supabase.auth.getSession().then(({ data: { session: s } }) => { load(s); });
}

export function useAuth() {
  bootstrap();
  const [snap, setSnap] = useState<AuthState>(state);
  useEffect(() => {
    const l = (s: AuthState) => setSnap(s);
    listeners.add(l);
    // Sync once in case state changed between render and effect.
    if (snap !== state) setSnap(state);
    return () => { listeners.delete(l); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = snap.role === "admin" || snap.role === "super_admin";
  const isStaff = isAdmin || snap.role === "employee";
  // Only block UI on the very first load (when we have no cached role at all).
  const loading = snap.loading && !snap.initialized && snap.role === null;

  return {
    session: snap.session,
    user: snap.user,
    role: snap.role,
    isAdmin,
    isStaff,
    permissions: snap.permissions,
    loading,
    initialized: snap.initialized,
  };
}
