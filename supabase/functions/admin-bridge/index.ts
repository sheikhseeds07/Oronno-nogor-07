import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
  },
});
const permissionKeys = ["dashboard","orders","order_import","products","offers","categories","customers","banners","coupons","landing_pages","employees","all_api","settings","dash_visitors","dash_web_orders","dash_incomplete","dash_confirmed_sales","dash_stock_alerts","dash_ads","dash_top_selling","dash_employee_perf","dash_stock_control","dash_hourly"] as const;
const validUuid = (s: string) => s.length === 36 && s[8] === "-" && s[13] === "-" && s[18] === "-" && s[23] === "-";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration missing" }, 500);

  const header = (req.headers.get("authorization") || "").trim();
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : header;
  if (!token) return json({ error: "Unauthorized" }, 401);
  let callerId = "";
  try {
    const part = token.split(".")[1];
    if (!part) throw new Error("Missing JWT payload");
    const normalized = part.replaceAll("-", "+").replaceAll("_", "/");
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    const rawIssuer = String(claims.iss ?? "");
    const issuer = rawIssuer.endsWith("/") ? rawIssuer.slice(0, -1) : rawIssuer;
    const baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    if (typeof claims.sub !== "string" || !claims.sub ||
        issuer !== baseUrl + "/auth/v1" ||
        claims.role !== "authenticated" ||
        !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= Math.floor(Date.now() / 1000)) {
      throw new Error("Invalid session");
    }
    callerId = claims.sub;
  } catch {
    return json({ error: "Unauthorized: invalid or expired session" }, 401);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request body" }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = String(body.action ?? "");
  const [{ data: roleRows, error: roleLookupError }, { data: permissionRow, error: permissionLookupError }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", callerId),
    admin.from("employee_permissions").select("employees").eq("user_id", callerId).maybeSingle(),
  ]);
  if (roleLookupError || permissionLookupError) return json({ error: roleLookupError?.message || permissionLookupError?.message || "Authorization lookup failed" }, 500);
  const roles = (roleRows ?? []).map((r) => r.role);
  const isSuperAdmin = roles.includes("super_admin");
  const canManageEmployees = isSuperAdmin || permissionRow?.employees === true;
  if (action === "employee_create" || action === "employee_update_role") {
    if (!isSuperAdmin) return json({ error: "শুধু CEO এই কাজটি করতে পারবেন" }, 403);
  } else if (action === "employee_reset_password") {
    if (!canManageEmployees) return json({ error: "Employees permission required" }, 403);
  } else return json({ error: "Unsupported admin action" }, 400);

  if (action === "employee_create") {
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const position = String(body.position ?? "").trim();
    const role = String(body.role ?? "employee");
    if (!name || name.length > 100 || phone.length > 32 || !email.includes("@") || !email.includes(".") || email.length > 255 ||
        password.length < 6 || password.length > 128 || !["super_admin","admin","employee"].includes(role)) {
      return json({ error: "Invalid employee details" }, 400);
    }
    const supplied = body.permissions && typeof body.permissions === "object" && !Array.isArray(body.permissions) ? body.permissions as Record<string, unknown> : {};
    const permissions: Record<string, boolean> = {};
    for (const key of permissionKeys) permissions[key] = supplied[key] === true;

    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, phone } });
    if (createError || !created.user) return json({ error: createError?.message || "Could not create login" }, 409);
    const userId = created.user.id;
    const { error: employeeError } = await admin.from("employees").insert({ name, phone: phone || null, email, position: position || null, user_id: userId, is_active: true });
    if (employeeError) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: "Employee profile could not be saved: " + employeeError.message }, 500);
    }
    const [{ error: roleError }, { error: permissionsError }] = await Promise.all([
      admin.from("user_roles").insert({ user_id: userId, role }),
      admin.from("employee_permissions").upsert({ user_id: userId, ...permissions, updated_at: new Date().toISOString() }, { onConflict: "user_id" }),
    ]);
    if (roleError || permissionsError) {
      await Promise.all([
        admin.from("employees").delete().eq("user_id", userId),
        admin.from("user_roles").delete().eq("user_id", userId),
        admin.from("employee_permissions").delete().eq("user_id", userId),
      ]);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: "Employee access setup failed: " + (roleError?.message || permissionsError?.message) }, 500);
    }
    return json({ ok: true, user_id: userId });
  }

  const userId = String(body.user_id ?? "").trim();
  if (!validUuid(userId)) return json({ error: "Invalid user ID" }, 400);
  if (action === "employee_reset_password") {
    const password = String(body.password ?? "");
    if (password.length < 6 || password.length > 128) return json({ error: "Password must be 6–128 characters" }, 400);
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: error.message }, 409);
    return json({ ok: true });
  }

  const role = String(body.role ?? "");
  if (!["super_admin","admin","employee"].includes(role)) return json({ error: "Invalid role" }, 400);
  const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
  if (targetError || !target.user) return json({ error: targetError?.message || "User not found" }, 404);
  const { error: updateError } = await admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (updateError) return json({ error: updateError.message }, 500);
  return json({ ok: true });
});
