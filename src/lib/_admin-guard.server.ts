// Shared server-side authorization helpers for staff/admin server functions.
// Always import from a server-only path; never imported by client code.
//
// Authorization model: the CEO (super_admin) has unrestricted access. Admin and
// Employee accounts only get the modules the CEO ticked in
// Employees → Permissions (public.employee_permissions).
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const AUTHZ_CACHE_TTL_MS = 20_000;
type PermissionMap = Record<string, boolean>;
type CachedAuthz = {
  expiresAt: number;
  isStaff: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: PermissionMap;
};
const authzCache = new Map<string, CachedAuthz>();
const authzInFlight = new Map<string, Promise<CachedAuthz>>();

async function loadAuthz(userId: string): Promise<CachedAuthz> {
  const cached = authzCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached;
  if (cached) authzCache.delete(userId);

  const existing = authzInFlight.get(userId);
  if (existing) return existing;

  const request = (async (): Promise<CachedAuthz> => {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const names = new Set((roles ?? []).map((r) => r.role));
    const isSuperAdmin = names.has("super_admin");
    const isAdmin = isSuperAdmin || names.has("admin");
    const isStaff = isAdmin || names.has("employee");

    let permissions: PermissionMap = {};
    if (isStaff && !isSuperAdmin) {
      const { data: perms } = await supabaseAdmin
        .from("employee_permissions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      permissions = (perms ?? {}) as PermissionMap;
    }

    const value = {
      expiresAt: Date.now() + AUTHZ_CACHE_TTL_MS,
      isStaff,
      isAdmin,
      isSuperAdmin,
      permissions,
    };
    // Cache only successful staff authorization contexts. Unknown/unauthorized
    // users are re-checked on every request, so this optimization never turns a
    // failed authorization into a cached allow.
    if (isStaff) authzCache.set(userId, value);
    return value;
  })();

  authzInFlight.set(userId, request);
  try {
    return await request;
  } finally {
    authzInFlight.delete(userId);
  }
}

export function clearAuthzCache(userId?: string) {
  if (userId) authzCache.delete(userId);
  else authzCache.clear();
}

export async function assertIsStaff(userId: string): Promise<void> {
  const authz = await loadAuthz(userId);
  if (authz.isStaff) return;
  throw new Error("Unauthorized");
}

/** Allows the CEO, or any staff member the CEO granted at least one of the modules. */
export async function assertPermission(userId: string, ...modules: string[]): Promise<void> {
  const authz = await loadAuthz(userId);
  if (!authz.isStaff) throw new Error("Unauthorized");
  if (authz.isSuperAdmin) return;
  if (modules.some((m) => authz.permissions[m] === true)) return;
  throw new Error("Unauthorized");
}

export async function assertCanManageOrders(userId: string): Promise<void> {
  await assertPermission(userId, "orders", "web_orders");
}

export async function assertIsAdmin(userId: string): Promise<void> {
  const authz = await loadAuthz(userId);
  if (authz.isAdmin) return;
  throw new Error("Unauthorized");
}

export async function assertIsSuperAdmin(userId: string): Promise<void> {
  const authz = await loadAuthz(userId);
  if (authz.isSuperAdmin) return;
  throw new Error("Unauthorized");
}
