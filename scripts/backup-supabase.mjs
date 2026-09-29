import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, chmodSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.env.BACKUP_DIR || "backups");
const dbUrl = process.env.OLD_DB_URL || process.env.SUPABASE_DB_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const envSource = process.env.ENV_SOURCE;

function need(name, value) {
  if (!value) throw new Error(name + " is required");
  return value;
}
need("OLD_DB_URL or SUPABASE_DB_URL", dbUrl);
need("SUPABASE_URL", supabaseUrl);
need("SUPABASE_SERVICE_ROLE_KEY", serviceKey);

mkdirSync(outDir, { recursive: true });

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit", env: process.env });
}

run("pg_dump", ["--dbname", dbUrl, "--format=p", "--no-owner", "--no-privileges", "--file", resolve(outDir, "db_full.sql")]);
run("supabase", ["db", "dump", "--db-url", dbUrl, "-f", resolve(outDir, "roles.sql"), "--role-only"]);
run("supabase", ["db", "dump", "--db-url", dbUrl, "-f", resolve(outDir, "schema.sql")]);
run("supabase", ["db", "dump", "--db-url", dbUrl, "-f", resolve(outDir, "data.sql"), "--use-copy", "--data-only"]);

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function listAll(bucket, path = "") {
  const out = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    const rows = data || [];
    for (const item of rows) {
      if (!item.metadata) out.push(...await listAll(bucket, path + item.name + "/"));
      else out.push({ bucket_id: bucket, name: path + item.name, id: item.id || null, created_at: item.created_at || null, updated_at: item.updated_at || null, metadata: item.metadata || null });
    }
    if (rows.length < 1000) break;
    offset += rows.length;
  }
  return out;
}

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
if (bucketError) throw bucketError;
const storageList = [];
for (const bucket of buckets || []) storageList.push(...await listAll(bucket.name));
writeFileSync(resolve(outDir, "storage_list.json"), JSON.stringify(storageList, null, 2) + "\n");

if (envSource) {
  if (!existsSync(envSource)) throw new Error("ENV_SOURCE does not exist");
  const target = resolve(outDir, "env_backup.txt");
  copyFileSync(envSource, target);
  chmodSync(target, 0o600);
}

const names = ["db_full.sql", "roles.sql", "schema.sql", "data.sql", "storage_list.json", "env_backup.txt"];
const sums = [];
for (const name of names) {
  const path = resolve(outDir, name);
  if (!existsSync(path)) continue;
  sums.push(createHash("sha256").update(readFileSync(path)).digest("hex") + "  " + name);
}
writeFileSync(resolve(outDir, "SHA256SUMS"), sums.join("\n") + "\n");
console.log("Backup complete. Keep generated files off Git and store an encrypted copy.");
