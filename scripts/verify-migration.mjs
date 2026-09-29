import { createClient } from "@supabase/supabase-js";

const oldUrl = process.env.OLD_SUPABASE_URL;
const oldKey = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const newUrl = process.env.NEW_SUPABASE_URL;
const newKey = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;

for (const [name, value] of Object.entries({
  OLD_SUPABASE_URL: oldUrl,
  OLD_SUPABASE_SERVICE_ROLE_KEY: oldKey,
  NEW_SUPABASE_URL: newUrl,
  NEW_SUPABASE_SERVICE_ROLE_KEY: newKey,
})) {
  if (!value) throw new Error(name + " is required");
}

const oldDb = createClient(oldUrl, oldKey, { auth: { persistSession: false, autoRefreshToken: false } });
const newDb = createClient(newUrl, newKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function countTable(client, table) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return Number(count || 0);
}

async function countAuthUsers(client) {
  let page = 1;
  let total = 0;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users || [];
    total += users.length;
    if (users.length < 1000) return total;
    page += 1;
  }
}

const checks = [];
for (const table of ["orders", "products", "profiles"]) {
  checks.push({ name: table, old: await countTable(oldDb, table), new: await countTable(newDb, table) });
}
checks.push({ name: "auth.users", old: await countAuthUsers(oldDb), new: await countAuthUsers(newDb) });

console.table(checks);
if (checks.some((x) => x.old !== x.new)) {
  console.error("CUTOVER BLOCKED: row counts do not match.");
  process.exit(1);
}
console.log("CUTOVER CHECK PASSED: row counts match.");
