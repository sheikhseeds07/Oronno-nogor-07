// Shared server-side authorization helpers for staff/admin server functions.
// Always import from a server-only path; never imported by client code.
//
// Authorization model: the CEO (super_admin) has unrestricted access. Admin and
// Employee accounts only get the modules the CEO ticked in
// Employees → Permissions (public.employee_permissions).
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const AUTHZ_CACHE_TTL_MS = 60_000;
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
    const { data: rawAccess, error } = await supabaseAdmin.rpc("get_my_staff_access");
    if (error) throw new Error(error.message);
    const access = rawAccess && typeof rawAccess === "object"
      ? rawAccess as Record<string, unknown>
      : {};
    if (access.user_id !== userId) throw new Error("Unauthorized");

    const role = typeof access.role === "string" ? access.role : null;
    const isSuperAdmin = role === "super_admin";
    const isAdmin = isSuperAdmin || role === "admin";
    const isStaff = isAdmin || role === "employee";
    const permissions = access.permissions && typeof access.permissions === "object"
      ? access.permissions as PermissionMap
      : {};

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

export async function getStaffAccess(userId: string): Promise<CachedAuthz> {
  const authz = await loadAuthz(userId);
  if (!authz.isStaff) throw new Error("Unauthorized");
  return authz;
}

/** Allows an administrator, or a staff member with the requested permission. */
export async function assertAdminOrPermission(userId: string, module: string): Promise<void> {
  const authz = await loadAuthz(userId);
  if (authz.isAdmin || authz.permissions[module] === true) return;
  throw new Error("Unauthorized");
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
  await assertPermission(userId, "orders");
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
