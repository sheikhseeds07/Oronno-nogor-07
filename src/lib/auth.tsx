import { useEffect, useState } from "react";
import { staffSupabase, customerSupabase } from "@/lib/personal-supabase/client";
import type { Session } from "@supabase/supabase-js";
import { markStaffBypass } from "@/lib/staff-bypass";

export type StaffRole = "super_admin" | "admin" | "employee" | null;
// Exactly the 13 modules the CEO can tick in Employees → Permissions.
export const PERMISSION_KEYS = ["dashboard", "orders", "order_import", "products", "offers", "categories", "customers", "banners", "coupons", "landing_pages", "employees", "all_api", "settings", "dash_visitors", "dash_web_orders", "dash_incomplete", "dash_confirmed_sales", "dash_stock_alerts", "dash_ads", "dash_top_selling", "dash_employee_perf", "dash_stock_control", "dash_hourly"] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type Permissions = Record<PermissionKey, boolean>;
export const ALL_TRUE: Permissions = Object.fromEntries(PERMISSION_KEYS.map(k => [k, true])) as Permissions;
const ALL_FALSE: Permissions = Object.fromEntries(Object.keys(ALL_TRUE).map(k => [k, false])) as Permissions;

type AuthSnapshot = { session: Session | null; user: Session["user"] | null; role: StaffRole; permissions: Permissions; loading: boolean; initialized: boolean; blocked?: boolean };
const staffState: AuthSnapshot = { session: null, user: null, role: null, permissions: ALL_FALSE, loading: true, initialized: false, blocked: false };
const customerState: AuthSnapshot = { session: null, user: null, role: null, permissions: ALL_FALSE, loading: true, initialized: false, blocked: false };
const listeners = new Set<() => void>();
let bootstrapped = false;
let staffLoadSeq = 0;

function notify() { listeners.forEach(l => l()); }
function setStaff(p: Partial<AuthSnapshot>) { Object.assign(staffState, p); notify(); }
function setCustomer(p: Partial<AuthSnapshot>) { Object.assign(customerState, p); notify(); }

// Strictly what the CEO ticked — no implicit fallback to "true" for any module.
const readPerms = (p: any): Permissions => Object.fromEntries(PERMISSION_KEYS.map(k => [k, k.startsWith("dash_") ? p?.[k] !== false : p?.[k] === true])) as Permissions;

function isStaffRoute() {
  if (typeof window === "undefined") return true;
  const path = window.location.pathname;
  return path === "/login" || path === "/admin" || path.startsWith("/admin/");
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (error) { lastError = error; if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, 250 * (i + 1))); }
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

function removeBlockedOverlay() {
  if (typeof document === "undefined") return;
  document.getElementById("ss-customer-blocked-overlay")?.remove();
  document.getElementById("ss-customer-blocked-style")?.remove();
  document.body.style.overflow = "";
}

function showBlockedOverlay() {
  if (typeof document === "undefined") return;
  if (document.getElementById("ss-customer-blocked-overlay")) return;
  const style = document.createElement("style");
  style.id = "ss-customer-blocked-style";
  style.textContent = `@keyframes ssBlockIn{from{opacity:0;transform:scale(.94) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}@keyframes ssBlockPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}#ss-customer-blocked-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,12,8,.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);font-family:inherit}#ss-customer-blocked-card{width:min(430px,100%);border:1px solid rgba(255,255,255,.16);border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(247,250,248,.98));box-shadow:0 35px 100px rgba(0,0,0,.38);padding:30px 24px;text-align:center;animation:ssBlockIn .45s cubic-bezier(.2,.8,.2,1)}#ss-customer-blocked-icon{width:72px;height:72px;margin:0 auto 18px;border-radius:24px;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#fee2e2,#fecaca);color:#dc2626;box-shadow:0 12px 30px rgba(220,38,38,.18);animation:ssBlockPulse 2.2s ease-in-out infinite}#ss-customer-blocked-card h2{margin:0;font-size:24px;font-weight:900;letter-spacing:-.03em;color:#18221d}#ss-customer-blocked-card p{margin:10px auto 0;max-width:340px;font-size:14px;line-height:1.75;color:#647067}#ss-customer-blocked-badge{display:inline-flex;margin-top:18px;padding:8px 13px;border-radius:999px;background:#fef2f2;color:#b91c1c;font-size:11px;font-weight:900;letter-spacing:.04em}`;
  document.head.appendChild(style);
  const overlay = document.createElement("div");
  overlay.id = "ss-customer-blocked-overlay";
  overlay.innerHTML = `<div id="ss-customer-blocked-card" role="alertdialog" aria-modal="true"><div id="ss-customer-blocked-icon"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4.5 6v5.5c0 4.7 3.2 8.9 7.5 9.5 4.3-.6 7.5-4.8 7.5-9.5V6L12 3Z"/><path d="M9.5 10.5 14.5 15.5M14.5 10.5 9.5 15.5"/></svg></div><h2>আপনাকে ব্লক করা হয়েছে</h2><p>আপনার অ্যাকাউন্টটি বর্তমানে ব্লক করা আছে। তাই Sheikh Seeds-এর ওয়েবসাইট ও আপনার অ্যাকাউন্টের কোনো সেবা ব্যবহার করা সম্ভব নয়।</p><span id="ss-customer-blocked-badge">ACCOUNT BLOCKED</span></div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
}

async function loadStaff(s: Session | null, force = false) {
  const seq = ++staffLoadSeq;
  const previousUserId = staffState.user?.id ?? null;
  if (!s?.user) { try { window.localStorage.removeItem("ss_auth_cache_v1"); } catch {} setStaff({ session: null, user: null, role: null, permissions: ALL_FALSE, loading: false, initialized: true }); return; }
  if (!force && staffState.initialized && previousUserId === s.user.id) { if (seq === staffLoadSeq) setStaff({ session: s, user: s.user, loading: false }); return; }
  const sameUser = previousUserId === s.user.id;

  // Reuse the last verified staff role/permissions immediately. This removes the
  // blank "Please wait..." gate on repeat admin visits; the server-side RLS still
  // remains the source of truth while fresh auth data is loaded in the background.
  let cachedRole: StaffRole | null = null;
  let cachedPermissions: Permissions = ALL_FALSE;
  if (sameUser || !staffState.initialized) {
    try {
      const raw = window.localStorage.getItem("ss_auth_cache_v1");
      const cached = raw ? JSON.parse(raw) : null;
      if (cached?.user_id === s.user.id && cached?.role) {
        cachedRole = cached.role as StaffRole;
        cachedPermissions = cached.permissions ? readPerms(cached.permissions) : ALL_FALSE;
        setStaff({ session: s, user: s.user, role: cachedRole, permissions: cachedPermissions, loading: true, initialized: true });
      }
    } catch {}
  }
  if (!cachedRole) setStaff({ session: s, user: s.user, loading: true, ...(sameUser ? {} : { role: null, permissions: ALL_FALSE }) });

  try {
    // Role and permission reads are independent, so don't wait for them serially.
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
    if (role === "super_admin") {
      permissions = ALL_TRUE;
    } else if (role) {
      const { data: p } = await withRetry(async () => {
        const result = await staffSupabase.from("employee_permissions").select("*").eq("user_id", s.user.id).maybeSingle();
        if (result.error) throw result.error;
        return result;
      });
      if (seq !== staffLoadSeq) return;
      permissions = p ? readPerms(p) : ALL_FALSE;
    }
    try { window.localStorage.setItem("ss_auth_cache_v1", JSON.stringify({ role, permissions, user_id: s.user.id })); } catch {}
    if (seq !== staffLoadSeq) return;
    if (role) markStaffBypass();
    setStaff({ session: s, user: s.user, role, permissions, loading: false, initialized: true });
  } catch {
    if (seq !== staffLoadSeq) return;
    // Keep a previously verified cache usable during a transient backend stall.
    if (cachedRole) {
      setStaff({ session: s, user: s.user, role: cachedRole, permissions: cachedPermissions, loading: false, initialized: true });
    } else {
      setStaff({ session: s, user: s.user, loading: false, initialized: true, ...(sameUser ? {} : { role: null, permissions: ALL_FALSE }) });
    }
  }
}

async function loadCustomer(s: Session | null) {
  if (!s?.user) { removeBlockedOverlay(); setCustomer({ session: null, user: null, role: null, permissions: ALL_FALSE, loading: false, initialized: true, blocked: false }); return; }
  setCustomer({ session: s, user: s.user, role: null, permissions: ALL_FALSE, loading: true, initialized: false });
  try {
    const { data, error } = await customerSupabase.from("customer_profiles").select("is_blocked").eq("id", s.user.id).maybeSingle();
    if (error) throw error;
    const blocked = !!data?.is_blocked;
    setCustomer({ session: s, user: s.user, role: null, permissions: ALL_FALSE, loading: false, initialized: true, blocked });
    if (blocked) showBlockedOverlay(); else removeBlockedOverlay();
  } catch {
    // A transient profile-read failure must not lock a valid customer out.
    setCustomer({ session: s, user: s.user, role: null, permissions: ALL_FALSE, loading: false, initialized: true, blocked: false });
    removeBlockedOverlay();
  }
}

function bootstrap() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;
  staffSupabase.auth.onAuthStateChange((event, s) => { if (event === "TOKEN_REFRESHED") { void loadStaff(s, false); return; } void loadStaff(s, true); });
  customerSupabase.auth.onAuthStateChange((_event, s) => { void loadCustomer(s); });

  // Auth must never be allowed to hold the entire storefront/admin UI on
  // "Please wait..." indefinitely. A stuck network/storage lock in Supabase
  // auth should degrade to a signed-out state; a later auth event can still
  // restore the real session without requiring a page reload.
  const getSessionWithTimeout = async (client: typeof staffSupabase) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        client.auth.getSession().then(({ data }) => data.session),
        new Promise<Session | null>((resolve) => {
          timer = setTimeout(() => resolve(null), 8000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  void getSessionWithTimeout(staffSupabase)
    .then(session => loadStaff(session, true))
    .catch(() => loadStaff(null, true));
  void getSessionWithTimeout(customerSupabase)
    .then(session => loadCustomer(session))
    .catch(() => loadCustomer(null));
}

function hideIncompleteForEmployee(role: StaffRole) {
  if (typeof document === "undefined") return;
  const apply = () => { if (role !== "employee") return; document.querySelectorAll("button").forEach(el => { const text = (el.textContent || "").trim().toLowerCase(); if (text.startsWith("incomplete")) (el as HTMLElement).style.display = "none"; }); };
  apply(); const observer = new MutationObserver(apply); observer.observe(document.body, { childList: true, subtree: true }); return () => observer.disconnect();
}

export function useAuth() {
  bootstrap(); const [, force] = useState(0);
  useEffect(() => { const listener = () => force(v => v + 1); listeners.add(listener); return () => { listeners.delete(listener); }; }, []);
  const customerMode = !isStaffRoute(); const snap = customerMode ? customerState : staffState;
  useEffect(() => hideIncompleteForEmployee(staffState.role), [staffState.role]);
  const isSuperAdmin = !customerMode && snap.role === "super_admin";
  const isAdmin = !customerMode && (snap.role === "admin" || snap.role === "super_admin");
  return { session: snap.session, user: snap.user, role: snap.role, isAdmin, isSuperAdmin, isStaff: !customerMode && (isAdmin || snap.role === "employee"), permissions: snap.permissions, loading: snap.loading && !snap.initialized, initialized: snap.initialized, blocked: !!snap.blocked };
}
