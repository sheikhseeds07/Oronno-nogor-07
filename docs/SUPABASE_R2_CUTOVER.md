# Supabase → R2 / new Supabase cutover runbook

## Verified production baseline — 2026-09-29

Before cutover, the old project currently has:
- orders: 13,886
- products: 33
- auth.users: 183
- profiles: 183
- Storage: 254 objects, about 57 MB total
- product-images: 49 objects, about 3.8 MB

Do not delete the old project.

## 1. Create a verified backup

Install PostgreSQL client tools and the Supabase CLI on a trusted machine, then run:

```bash
export OLD_DB_URL='postgresql://...'
export SUPABASE_URL='https://YOUR_OLD_PROJECT.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='...'
export ENV_SOURCE='.env.production'
node scripts/backup-supabase.mjs
sha256sum -c backups/SHA256SUMS
```

Generated files are intentionally ignored by Git because they can contain customer PII, password hashes and credentials.

Keep an encrypted off-repository copy of the whole backup folder.

The preferred restore set is:
- roles.sql
- schema.sql
- data.sql

db_full.sql is retained as an additional full logical dump, not as the only recovery mechanism.

Storage object bytes are separate from the PostgreSQL dump. storage_list.json is a manifest; media must also be copied to R2 or separately downloaded.

## 2. Migrate product images to Cloudflare R2

Authenticate Wrangler with a Cloudflare API token that can manage R2, then:

```bash
export SUPABASE_URL='https://YOUR_OLD_PROJECT.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='...'
export R2_PUBLIC_URL='https://cdn.example.com'
export R2_BUCKET='ecom-products'
export MIGRATE_BUCKETS='product-images'
node scripts/migrate-to-r2.js
```

The script:
1. creates ecom-products if it does not exist;
2. recursively downloads product-images from Supabase Storage;
3. uploads them to R2 under product-images/<original path>;
4. preserves MIME type;
5. sets Cache-Control: public, max-age=31536000;
6. writes backups/r2_migration_manifest.json;
7. exits non-zero if any object fails.

Do not delete the Supabase Storage originals after copying.

The UI image helper rewrites existing product-image URLs to VITE_R2_PUBLIC_URL at render time, so existing database rows do not need a risky bulk URL rewrite. Profile and review uploads remain on their original storage path; do not globally replace every getPublicUrl() call.

## 3. Create and bind SUPA_CACHE

```bash
npx wrangler kv namespace create SUPA_CACHE
```

Bind that namespace to the production Worker/Pages project using binding name:

```
SUPA_CACHE
```

Anonymous product GET responses are cached for 3600 seconds. Authenticated/admin requests, orders, checkout writes and user-specific data are never put in this cache.

Anonymous landing_pages reads also go through the existing same-origin edge cache because current logs show landing_pages traffic is materially larger than product traffic.

## 4. Environment variables

Configure these before deploying the migration branch:

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY   # server only
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
R2_PUBLIC_URL
VITE_R2_PUBLIC_URL
```

Never create a VITE_SUPABASE_SERVICE_ROLE_KEY variable.

The migration branch removes the production Supabase URL/key fallback from runtime client configuration. Missing env configuration should fail rather than silently point to the old database.

## 5. Restore to the new Supabase project

Get the new project's database connection string (Session Pooler is normally the easiest IPv4-compatible option), then:

```bash
export NEW_DB_URL='postgresql://...'

psql --dbname "$NEW_DB_URL" --variable ON_ERROR_STOP=1 --file backups/roles.sql
psql --dbname "$NEW_DB_URL" --variable ON_ERROR_STOP=1 --file backups/schema.sql
psql --dbname "$NEW_DB_URL" --variable ON_ERROR_STOP=1 --file backups/data.sql
```

Deploy the repository's Edge Functions to the new project and recreate their server-side secrets. Recreate external webhook URLs and cron jobs against the new project only after database verification.

## 6. Mandatory cutover gate

```bash
OLD_SUPABASE_URL='...' \
OLD_SUPABASE_SERVICE_ROLE_KEY='...' \
NEW_SUPABASE_URL='...' \
NEW_SUPABASE_SERVICE_ROLE_KEY='...' \
node scripts/verify-migration.mjs
```

The script blocks cutover unless these exact counts match old vs new:
- orders
- products
- profiles
- auth.users

After the count check, smoke-test:
1. customer login/logout;
2. home, catalog, product and landing pages;
3. product images from the R2 custom domain;
4. one test order;
5. admin order view/update;
6. password reset;
7. courier sync;
8. every required Edge Function/webhook.

## 7. Realtime and log usage

Do not treat Realtime as the main source of the current usage spike. The inspected 24-hour log window showed roughly 503k edge events, while Realtime websocket/log activity was tiny by comparison. The dominant historical problem was an orders PATCH storm.

The latest Steadfast sync code already contains:
- a 12-hour reconciliation cooldown;
- no orders PATCH when courier/business status is unchanged.

Do not remove Realtime from production until equivalent polling/notification behavior has been deployed and smoke-tested. After that, remove only the tables no longer needing publication, not unrelated messaging tables.

Log Drains are not the same as Logs Ingest. Reducing request volume, duplicate reads and write loops is the priority.

## 8. Rollback window

Keep the old project active until the new production deployment is verified. Then pause the old project for 7 days; do not delete it. If rollback is required, restore the old environment variables and redeploy the known-good revision. Keep a final encrypted backup before any future deletion decision.
