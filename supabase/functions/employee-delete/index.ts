import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration missing" }, 500);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  // The Edge gateway has already cryptographically verified this JWT
  // (verify_jwt=true). Read its subject locally to avoid a second Auth API
  // round-trip, which can reject newer asymmetric ES256 access tokens.
  let callerId = "";
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) throw new Error("Missing JWT payload");
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    const issuer = String(payload.iss ?? "").replace(/\/$/, "");
    const exp = Number(payload.exp ?? 0);
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      issuer !== url.replace(/\/$/, "") + "/auth/v1" ||
      payload.role !== "authenticated" ||
      !Number.isFinite(exp) ||
      exp <= Math.floor(Date.now() / 1000)
    ) throw new Error("Invalid or expired access token");
    callerId = payload.sub;
  } catch {
    return json({ error: "Unauthorized: invalid or expired session" }, 401);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    const value = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return json({ error: "Invalid request body" }, 400);
    }
    body = value as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const employeeId = String(body.employee_id ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(employeeId)) {
    return json({ error: "Invalid employee ID" }, 400);
  }

  // Match assertPermission(userId, "employees"): super_admin is allowed;
  // other staff need the explicit Employees module permission.
  const [{ data: roles, error: roleError }, { data: perms, error: permError }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", callerId),
    admin.from("employee_permissions").select("employees").eq("user_id", callerId).maybeSingle(),
  ]);
  if (roleError || permError) {
    return json({ error: roleError?.message || permError?.message || "Permission lookup failed" }, 500);
  }
  const isSuperAdmin = (roles ?? []).some((row) => row.role === "super_admin");
  if (!isSuperAdmin && perms?.employees !== true) {
    return json({ error: "Unauthorized: Employees permission required" }, 403);
  }

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id,user_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (employeeError) return json({ error: employeeError.message }, 500);
  if (!employee) return json({ error: "Employee not found" }, 404);

  const targetUserId = employee.user_id ? String(employee.user_id) : null;

  // Block deletion only when unconfirmed Processing (web_pending) orders remain assigned.
  // Historical, shipped, delivered, cancelled and other statuses do not block deletion.
  if (targetUserId) {
    const { count: assignedOrderCount, error: assignedOrdersError } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", targetUserId)
      .eq("status", "web_pending");

    if (assignedOrdersError) {
      return json({ error: "অর্ডার যাচাই করা যায়নি। নিরাপত্তার জন্য Employee ডিলিট করা হয়নি: " + assignedOrdersError.message }, 500);
    }
    if ((assignedOrderCount ?? 0) > 0) {
      return json({
        error: "দুঃখিত! এই কর্মীর নামে এখনো অর্ডার অ্যাসাইন করা রয়েছে। অনুগ্রহ করে আগে অর্ডারগুলো অন্য কর্মীকে অ্যাসাইন করুন অথবা Unassign করুন। এরপর কর্মীকে ডিলিট করতে পারবেন.",
        code: "EMPLOYEE_HAS_ASSIGNED_ORDERS",
        assigned_order_count: assignedOrderCount,
      }, 409);
    }
  }

  // Only remove the Auth account after confirming no orders remain assigned.
  // If Auth deletion fails, keep the employee profile untouched.
  if (targetUserId) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetUserId);
    if (authDeleteError) {
      return json({ error: "Could not delete employee login: " + authDeleteError.message }, 409);
    }
  }

  // Delete only the selected employee/access rows. Preserve historical order
  // attribution and assignment data.
  const cleanup = await Promise.all([
    admin.from("employees").delete().eq("id", employeeId),
    ...(targetUserId
      ? [
          admin.from("employee_permissions").delete().eq("user_id", targetUserId),
          admin.from("user_roles").delete().eq("user_id", targetUserId),
        ]
      : []),
  ]);
  const cleanupError = cleanup.find((result) => result.error)?.error;
  if (cleanupError) {
    return json({ error: "Login removed, but employee record cleanup failed: " + cleanupError.message }, 500);
  }

  return json({ ok: true, deleted_employee_id: employeeId });
});
