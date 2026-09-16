// Shared server-side authorization helpers for staff/admin server functions.
// Always import from a server-only path; never imported by client code.
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { readPermissions, type PermissionKey, type Permissions } from "@/lib/permissions";

const AUTHZ_CACHE_TTL_MS = 20_000;
type CachedAuthz = {
  expiresAt: number;
  isStaff: boolean;
  isSuperAdmin: boolean;
  isAdminRole: boolean;
  permissions: Permissions;
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
    const isAdminRole = isSuperAdmin || names.has("admin");
    const isStaff = isAdminRole || names.has("employee");

    let permissions = readPermissions(null);
    if (isStaff && !isSuperAdmin) {
      const { data: perms } = await supabaseAdmin
        .from("employee_permissions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      permissions = readPermissions(perms as Record<string, unknown> | null);
    }

    const value = {
      expiresAt: Date.now() + AUTHZ_CACHE_TTL_MS,
      isStaff,
      isSuperAdmin,
      isAdminRole,
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

export function invalidateAuthzCache(userId?: string) {
  if (userId) authzCache.delete(userId);
  else authzCache.clear();
}

export async function assertIsStaff(userId: string): Promise<void> {
  const authz = await loadAuthz(userId);
  if (authz.isStaff) return;
  throw new Error("Unauthorized");
}

/** Allows the CEO (super_admin) or any staff member holding at least one of the given permissions. */
export async function assertPermission(userId: string, ...keys: PermissionKey[]): Promise<void> {
  const authz = await loadAuthz(userId);
  if (!authz.isStaff) throw new Error("Unauthorized");
  if (authz.isSuperAdmin) return;
  if (keys.some((k) => authz.permissions[k])) return;
  throw new Error("Unauthorized");
}

export async function hasServerPermission(userId: string, ...keys: PermissionKey[]): Promise<boolean> {
  const authz = await loadAuthz(userId);
  if (!authz.isStaff) return false;
  if (authz.isSuperAdmin) return true;
  return keys.some((k) => authz.permissions[k]);
}

export async function assertCanManageOrders(userId: string): Promise<void> {
  await assertPermission(userId, "orders", "web_orders");
}

/** CEO-only operations. */
export async function assertIsSuperAdmin(userId: string): Promise<void> {
  const authz = await loadAuthz(userId);
  if (authz.isSuperAdmin) return;
  throw new Error("Unauthorized");
}

/** Kept for compatibility: settings-level administrative actions. */
export async function assertIsAdmin(userId: string): Promise<void> {
  await assertPermission(userId, "settings");
}
