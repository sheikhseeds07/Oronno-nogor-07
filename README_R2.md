# Sheikh Seeds: Supabase Storage -> Cloudflare R2

This branch moves public/site image traffic away from Supabase Storage and serves it from the R2 custom domain:

- Site: https://sheikhseeds.com
- R2 public domain: https://images.sheikhseeds.com
- Supabase project: frtzlibogmethppqmhtr

## Important architecture note

The current repository is **TanStack Start + Vite on Cloudflare Workers**, not Next.js 14. Do not add `next/image`; it would break this application. The equivalent fix here is a fixed 1:1 media container, responsive `sizes`, stable dimensions, skeleton loading, and direct R2 delivery.

Browser uploads are resized to max 800px and converted to WebP at quality 0.80 before being sent to the authenticated server endpoint. The migration script also uses `sharp` to convert legacy assets to WebP.

## 1. Create/configure R2

Create an R2 bucket and connect `images.sheikhseeds.com` as its custom domain.

Create an R2 API token scoped to this bucket with Object Read & Write permission. Set the environment values from `.env.example` in the deployment environment.

Required secrets:

```bash
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_PUBLIC_URL=https://images.sheikhseeds.com
SUPABASE_SERVICE_ROLE_KEY=...
```

Never expose the R2 secret keys or Supabase service-role key to browser variables.

## 2. Install dependencies

```bash
bun install
```

This installs the pinned R2 SDK and Sharp dependencies added to `package.json`.

## 3. Run migration

Use the production secrets locally or in a trusted CI runner:

```bash
bun run scripts/migrate-storage.ts
```

The script:

1. Reads `products.images[]`, `categories.image_url`, and `banners.image_url`.
2. Only migrates values that resolve to Supabase Storage.
3. Processes 50 rows concurrently.
4. Retries each failed asset up to 3 times.
5. Downloads with the existing URL first, then falls back to service-role Storage download.
6. Preserves the original bucket/folder object path in R2.
7. Converts image bytes to WebP, max 800x800, quality 80.
8. Updates only the corresponding image columns. It never reads or writes `orders`.
9. Re-reads all three tables and exits with an error unless zero Supabase Storage URLs remain.

The migration is safe to rerun. Existing R2 keys are overwritten with the same content/key and already-migrated database URLs are skipped.

## 4. Verify before locking Supabase Storage

Check the storefront, category pages, product quick view, banners, admin product editor, logo/SEO image upload, customer avatar/cover uploads, and review-image uploads.

Also verify directly in SQL:

```sql
select count(*) as remaining_product_urls
from public.products p,
lateral unnest(coalesce(p.images, '{}'::text[])) u(url)
where url like '%supabase.co/storage%';

select count(*) from public.categories where image_url like '%supabase.co/storage%';
select count(*) from public.banners where image_url like '%supabase.co/storage%';
```

All three results must be 0.

## 5. Make Supabase buckets private

Only after visual verification:

```bash
bun run scripts/lock-supabase-storage.ts
```

This uses the Supabase Storage API to mark any remaining public bucket private. It does not delete files. Keeping the old objects for a rollback window is safer than deleting them immediately.

## 6. Cloudflare cache rules

For `images.sheikhseeds.com` create a Cache Rule:

- Hostname equals `images.sheikhseeds.com`
- Cache eligibility: Eligible for cache / Cache Everything
- Edge Cache TTL: 1 month or longer
- Browser TTL: Respect existing headers, or 1 year
- Enable Smart Tiered Cache for the R2 custom domain if available

R2 uploads are written with:

```
Cache-Control: public, max-age=31536000, immutable
```

Use unique object names for changed images. The upload helper already does this.

## Rollback

Do not delete Supabase Storage objects immediately. If a deployment problem occurs, switch the app back to the previous branch and make required buckets public again. Database image URLs changed to R2 during migration, so a database backup taken immediately before migration is recommended for a complete rollback.

## Egress expectations

After the migration and application cutover, product/category/banner image requests no longer go to Supabase Storage. Supabase database/API traffic still exists, so total Supabase network usage is not literally zero; **Storage image egress** should approach zero. Confirm this in Supabase usage metrics after traffic has passed through the new deployment.
