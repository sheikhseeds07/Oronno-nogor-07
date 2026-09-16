// Central permission registry for the admin/employee panel.
// Client-safe: no server-only imports here.

export type PermissionDef = { key: string; label: string; group: string; defaultOn?: boolean };

export const PERMISSION_DEFS = [
  // Dashboard
  { key: "dashboard", label: "Dashboard", group: "Dashboard", defaultOn: true },
  { key: "dashboard_live_visitors", label: "Dashboard · Live Visitors", group: "Dashboard", defaultOn: true },
  { key: "dashboard_web_orders", label: "Dashboard · Web Order", group: "Dashboard", defaultOn: true },
  { key: "dashboard_incomplete_orders", label: "Dashboard · Incomplete Order", group: "Dashboard", defaultOn: true },
  { key: "dashboard_stock_alert", label: "Dashboard · Stock Alert", group: "Dashboard", defaultOn: true },
  { key: "dashboard_confirmed_sell", label: "Dashboard · Confirmed Sell", group: "Dashboard", defaultOn: true },
  { key: "dashboard_meta_ads", label: "Dashboard · Meta Ads", group: "Dashboard", defaultOn: true },
  { key: "dashboard_time_filter", label: "Dashboard · Time Filter", group: "Dashboard", defaultOn: true },
  // Orders
  { key: "orders", label: "Orders", group: "Orders" },
  { key: "web_orders", label: "Web Orders", group: "Orders" },
  { key: "new_order", label: "New Order", group: "Orders" },
  { key: "order_import", label: "Import Orders", group: "Orders" },
  { key: "deleted_orders", label: "Deleted Orders", group: "Orders" },
  { key: "order_division", label: "Order Division", group: "Orders" },
  { key: "order_rate_limit", label: "Order Rate Limit", group: "Orders" },
  { key: "courier", label: "Courier", group: "Orders" },
  // Catalog
  { key: "products", label: "Products", group: "Catalog" },
  { key: "categories", label: "Categories", group: "Catalog" },
  { key: "offers", label: "Offers / Combo", group: "Catalog" },
  // Customers
  { key: "customers", label: "Customers", group: "Customers" },
  { key: "customer_management", label: "Customer Management", group: "Customers" },
  { key: "customer_feedback", label: "Reviews / Questions", group: "Customers" },
  { key: "messages", label: "Messages / Inbox", group: "Customers" },
  // Marketing
  { key: "marketing", label: "Marketing (Banners/Coupons)", group: "Marketing" },
  { key: "landing_pages", label: "Landing Pages", group: "Marketing" },
  { key: "landing_template", label: "Landing Template", group: "Marketing" },
  { key: "landing_seeds", label: "Landing Seeds", group: "Marketing" },
  { key: "meta_ad_account", label: "Meta Ad Account", group: "Marketing" },
  // Operations
  { key: "delivery", label: "Delivery", group: "Operations" },
  { key: "reports", label: "Reports", group: "Operations" },
  { key: "hrm", label: "HRM / Employees", group: "Operations" },
  { key: "attendance", label: "Attendance", group: "Operations" },
  { key: "integrations", label: "Integrations", group: "Operations" },
  { key: "all_api", label: "All APIs", group: "Operations" },
  { key: "settings", label: "Settings", group: "Operations" },
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSION_DEFS)[number]["key"];
export type Permissions = Record<PermissionKey, boolean>;

export const PERMISSION_KEYS = PERMISSION_DEFS.map((p) => p.key) as PermissionKey[];
export const PERM_LABELS: { key: PermissionKey; label: string; group: string }[] = PERMISSION_DEFS.map((p) => ({
  key: p.key as PermissionKey,
  label: p.label,
  group: p.group,
}));
export const PERMISSION_GROUPS = Array.from(new Set(PERM_LABELS.map((p) => p.group)));

export const ALL_TRUE: Permissions = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])) as Permissions;
export const ALL_FALSE: Permissions = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])) as Permissions;
// Dashboard widget flags stay visible unless explicitly turned off.
export const DEFAULT_PERMISSIONS: Permissions = Object.fromEntries(
  PERMISSION_DEFS.map((p) => [p.key, !!p.defaultOn]),
) as Permissions;

/** Normalize a stored employee_permissions row into a complete Permissions object. */
export function readPermissions(row: Record<string, unknown> | null | undefined): Permissions {
  if (!row) return { ...ALL_FALSE };
  const out = {} as Permissions;
  for (const def of PERMISSION_DEFS) {
    const value = row[def.key];
    out[def.key as PermissionKey] = def.defaultOn ? value !== false : !!value;
  }
  return out;
}

/**
 * Admin route → required permission. "always" means every staff member may open it.
 * Longest matching prefix wins.
 */
export const ADMIN_ROUTE_PERMISSIONS: { path: string; perm: PermissionKey | "always"; exact?: boolean }[] = [
  { path: "/admin", perm: "always", exact: true },
  { path: "/admin/fb-callback", perm: "always" },
  { path: "/admin/employees_", perm: "always" },
  { path: "/admin/orders", perm: "orders" },
  { path: "/admin/order-import", perm: "order_import" },
  { path: "/admin/deleted-orders", perm: "deleted_orders" },
  { path: "/admin/order-division", perm: "order_division" },
  { path: "/admin/order-rate-limit", perm: "order_rate_limit" },
  { path: "/admin/courier", perm: "courier" },
  { path: "/admin/products", perm: "products" },
  { path: "/admin/categories", perm: "categories" },
  { path: "/admin/offers", perm: "offers" },
  { path: "/admin/customers", perm: "customers" },
  { path: "/admin/customer-management", perm: "customer_management" },
  { path: "/admin/customer-feedback", perm: "customer_feedback" },
  { path: "/admin/banners", perm: "marketing" },
  { path: "/admin/coupons", perm: "marketing" },
  { path: "/admin/landing-pages", perm: "landing_pages" },
  { path: "/admin/landing-template", perm: "landing_template" },
  { path: "/admin/landing-seeds", perm: "landing_seeds" },
  { path: "/admin/meta-ad-account", perm: "meta_ad_account" },
  { path: "/admin/integrations", perm: "integrations" },
  { path: "/admin/employees", perm: "hrm" },
  { path: "/admin/attendance", perm: "attendance" },
  { path: "/admin/all-api", perm: "all_api" },
  { path: "/admin/settings", perm: "settings" },
];

export function requiredPermissionForPath(pathname: string): PermissionKey | "always" | null {
  let best: { path: string; perm: PermissionKey | "always" } | null = null;
  for (const entry of ADMIN_ROUTE_PERMISSIONS) {
    const hit = entry.exact ? pathname === entry.path : pathname === entry.path || pathname.startsWith(`${entry.path}/`);
    if (!hit) continue;
    if (!best || entry.path.length > best.path.length) best = entry;
  }
  return best ? best.perm : null;
}

export function hasPermission(
  role: string | null,
  permissions: Permissions | null | undefined,
  perm: PermissionKey | "always" | null,
): boolean {
  if (role === "super_admin") return true;
  if (!role) return false;
  if (perm === "always") return true;
  if (!perm) return false;
  return !!permissions?.[perm];
}
