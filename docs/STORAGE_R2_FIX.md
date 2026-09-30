# R2 Storage fix — 30 September 2026

The screenshot's **Log Query 47.556 GB is log data scanned by log reads**, not 47.556 GB of generated logs. Log Ingestion is separately 0.476 GB. Supabase documents that Studio, Management API, CLI, agent/MCP log reads and scripted polling can repeatedly scan the same data. This repository contains no Logs API polling implementation. The exact reader responsible for the historical 47.556 GB cannot be attributed from this screenshot or this code audit. An infinite logging loop is not established.

Primary sources checked:
- https://supabase.com/docs/guides/platform/manage-your-usage/logs-query
- https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest

Two concrete bugs were found: `src/routes/media.ts` fetched a Supabase Storage object whenever R2 missed; `src/lib/img.ts` scheduled image retries and ultimately assigned the old signed/public Storage URL. Both could generate additional Storage requests, egress and service logs. Neither directly performs Log Query scans.

Media now validates the key, reads R2 once, coalesces concurrent reads, caches successful objects and caches missing objects for 60 seconds. A failed R2 read returns a bounded 503 without logging or an origin fallback. All 94 JSX images, plus the two cart-animation images created with DOM APIs, normalize their source and stop at an embedded static placeholder after one failure. Legacy DB URL strings are parsed locally into R2 keys; no old token is forwarded and no DB URL rewrite is needed.

Five obsolete deployed migration functions were already retired by the incoming main-branch repair; their current live source was checked and confirmed to return 410 without storage, SDK or DB activity. Their source and deployed versions are preserved. The Worker backfill route also returns a bounded 410. Old migration scripts fail closed; their automatic push/repository-dispatch workflow is removed. New uploads keep their existing authentication/role queries and use only R2, with one bounded error on failure.

`R2_PUBLIC_URL=/media` explicitly selects the existing `MEDIA_BUCKET` binding and is supplied through `.env`, Wrangler and CI. Missing/blank/invalid configuration fails while loading Vite config. No custom domain or DNS change is required. Public schema and `auth.debug: false` are explicit; Storage-only fetch guards leave REST, Auth and Functions requests unchanged.

Validation completed:
- Full production build succeeded and produced `.output/server/index.mjs` and public assets.
- 17 Storage regression checks plus all 5 incoming usage-guard tests passed, covering R2 miss/error/cache/coalescing, signed metadata normalization, srcset, single image fallback, retired functions and authenticated R2 upload failure/success.
- Real Chromium mobile test (390×844): one failed asset GET; 20 extra error events and a parent rerender caused zero retries; zero Supabase requests; changing the source loaded a valid image.
- Actual Vite build with `R2_PUBLIC_URL=''` failed at config load as required.
- 115 Supabase query chains (361 query expressions) across 50 modified source files were unchanged. Retired storage-inventory/backfill code is excluded because it no longer executes.
- Full typecheck has existing repository errors: current-main baseline 20 distinct diagnostics, final 18, zero new diagnostics. The existing database/order/dashboard issues were left outside this Storage repair.
- This patch changes no database schema, rows, credentials, SQL migrations, business query logic or courier/AI functions. Concurrent upstream changes to query projections, rate limits, logging and polling are preserved.

Already accumulated billing-cycle usage will not be reduced by this code patch. Stop repeated broad log reads/polling and use narrow time ranges for any necessary investigation.

## Exact file changes

64 files differ from main commit `d81d3a6591006d1efb311c4e918b6fd69baa9a94`.

| File | Change |
| --- | --- |
| `.env` | Configure the required same-origin R2 endpoint. |
| `.env.example` | Document the required R2 configuration without secrets. |
| `.github/workflows/build-check.yml` | Run Storage regression checks and provide the required build endpoint. |
| `.github/workflows/migrate-supabase-storage-to-r2.yml` | Retire automatic legacy Storage migration triggers and network work. |
| `docs/STORAGE_R2_FIX.md` | Record precise findings, limitations, changed paths and validation. |
| `package.json` | Add the Storage check command and point old migration commands at the retired entry point. |
| `scripts/check-storage-regression.mjs` | Verify storage isolation and bounded failure behavior. |
| `scripts/migrate-supabase-storage-to-r2.mjs` | Fail closed instead of listing/signing/downloading Storage objects. |
| `scripts/migrate-to-r2.ts` | Fail closed for old direct script invocations. |
| `src/components/SafeImage.tsx` | Normalize image URLs to R2 and remember a failed source so repeated errors or parent rerenders cannot retry it. |
| `src/integrations/supabase/client.server.ts` | Add Storage-only fetch blocking and/or explicit public schema/debug=false; preserve current-main DB/Auth fetch behavior. |
| `src/integrations/supabase/client.ts` | Add Storage-only fetch blocking and/or explicit public schema/debug=false; preserve current-main DB/Auth fetch behavior. |
| `src/integrations/supabase/public-env.ts` | Add Storage-only fetch blocking and/or explicit public schema/debug=false; preserve current-main DB/Auth fetch behavior. |
| `src/lib/img.ts` | Remove delayed retries and original Storage fallback; normalize to R2. |
| `src/lib/personal-supabase/client.server.ts` | Add Storage-only fetch blocking and/or explicit public schema/debug=false; preserve current-main DB/Auth fetch behavior. |
| `src/lib/personal-supabase/client.ts` | Add Storage-only fetch blocking and/or explicit public schema/debug=false; preserve current-main DB/Auth fetch behavior. |
| `src/lib/r2-config.ts` | Validate the build-time public media configuration. |
| `src/lib/r2-media.ts` | Share validated media keys, permitted buckets, and local legacy-metadata parsing. |
| `src/lib/retired-storage.ts` | Return local 410 for retired Storage SDK fetches. |
| `src/routeTree.gen.ts` | Register the existing R2 upload/backfill route files in generated route types. |
| `src/routes/api/internal/r2-backfill.ts` | Retire the old Storage backfill endpoint with 410. |
| `src/routes/api/media/upload.ts` | Validate the R2 key and bound R2 failures without SSR logging; preserve authorization queries. |
| `src/routes/media.ts` | Remove Supabase fetch/write-through fallback; cache R2 success and miss; no retry/logging. |
| `tests/usage-guards.test.mjs` | Update isolated test loaders for shared media utilities and mock an empty R2 bucket when checking a missing object. |
| `vite.config.ts` | Validate R2_PUBLIC_URL before build and inject the validated media endpoint. |
| `wrangler.jsonc` | Configure the existing binding endpoint as /media. |

The following 38 UI files use `SafeImage` for every JSX image. Existing image error handlers that could retry are removed. `ProductCard.tsx` and `routes/offers.tsx` also protect their DOM-created cart-animation images; `admin/orders.tsx` reuses the validated R2 normalizer for thumbnails. Current-main query expressions are preserved.

- `src/components/admin/AdminLayout.tsx`
- `src/components/ai-elements/attachments.tsx`
- `src/components/community/OfficialReply.tsx`
- `src/components/community/ProductTabs.tsx`
- `src/components/landing/AllProductLandingPage.tsx`
- `src/components/landing/CleanLandingPage.tsx`
- `src/components/landing/GuaranteePopup.tsx`
- `src/components/landing/LegacyLandingPage.tsx`
- `src/components/landing/NutrimixReviews.tsx`
- `src/components/landing/ProductStyleLandingPage.tsx`
- `src/components/landing/ProfessionalLandingPage.tsx`
- `src/components/landing/lp-shared.tsx`
- `src/components/layout/BrandLoader.tsx`
- `src/components/layout/CustomerBottomNav.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/layout/Header.tsx`
- `src/components/offers/OfferDetailDialog.tsx`
- `src/components/shop/CartDrawer.tsx`
- `src/components/shop/ProductCard.tsx`
- `src/components/shop/ProductQuickView.tsx`
- `src/routes/admin/banners.tsx`
- `src/routes/admin/categories.tsx`
- `src/routes/admin/customer-management.tsx`
- `src/routes/admin/employees_.$userId.tsx`
- `src/routes/admin/landing-pages.tsx`
- `src/routes/admin/landing-seeds.tsx`
- `src/routes/admin/offers.tsx`
- `src/routes/admin/orders.tsx`
- `src/routes/admin/products.tsx`
- `src/routes/admin/settings.tsx`
- `src/routes/cart.tsx`
- `src/routes/category.$slug.tsx`
- `src/routes/checkout.tsx`
- `src/routes/index.tsx`
- `src/routes/offers.tsx`
- `src/routes/order.$id.tsx`
- `src/routes/product.$slug.tsx`
- `src/routes/profile.tsx`
