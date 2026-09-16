// Shared server-side authorization helpers for staff/admin server functions.
// Always import from a server-only path; never imported by client code.
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const AUTHZ_CACHE_TTL_MS = 20_000;
type CachedAuthz = {
  expiresAt: number;
  isStaff: boolean;
  isAdmin: boolean;
  canManageOrders: boolean;
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
    const isAdmin = names.has("super_admin") || names.has("admin");
    const isStaff = isAdmin || names.has("employee");

    let canManageOrders = isAdmin;
    if (!canManageOrders) {
      const { data: perms } = await supabaseAdmin
        .from("employee_permissions")
        .select("orders,web_orders")
        .eq("user_id", userId)
        .maybeSingle();
      canManageOrders = Boolean(perms?.orders || perms?.web_orders);
    }

    const value = {
      expiresAt: Date.now() + AUTHZ_CACHE_TTL_MS,
      isStaff,
      isAdmin,
      canManageOrders,
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

export async function assertIsStaff(userId: string): Promise<void> {
  const authz = await loadAuthz(userId);
  if (authz.isStaff) return;
  throw new Error("Unauthorized");
}

export async function assertCanManageOrders(userId: string): Promise<void> {
  const authz = await loadAuthz(userId);
  if (authz.canManageOrders) return;
  throw new Error("Unauthorized");
}

export async function assertIsAdmin(userId: string): Promise<void> {
  const authz = await loadAuthz(userId);
  if (authz.isAdmin) return;
  throw new Error("Unauthorized");
}
