# Safe media and logging fix — 1 October 2026

The existing site is hosted by Cloudflare Workers at https://sheikhseeds.com/, not Vercel. The pre-change live homepage rendered 29 images with no broken images. Commit 346254a was already on main before this follow-up.

Changes preserve database queries, Auth client behavior, business pages and R2 upload code. The old fetch hook now returns null instead of synthesizing 410. No Supabase Storage image fallback or Storage migration is restored.

| Changed file | Purpose |
| --- | --- |
| `public/placeholder.png` | Real static PNG, matching the previous neutral placeholder. |
| `src/lib/r2.ts` | One R2 read; null or rejection resolves to `/placeholder.png`, without throw, logging or retry. |
| `src/lib/img.ts` | Use the static PNG; null the native error handler before one fallback. |
| `src/components/SafeImage.tsx` | Replace a failed image immediately; clear srcset; keep failure state across parent rerenders; permit a genuinely changed source. |
| `src/routes/media.ts` | Redirect failed/missing R2 reads to the PNG; cache misses for 60 seconds; preserve successful R2 reads, ETags and private-bucket protection. |
| `src/lib/logger.ts` | All existing application logging becomes a no-op in every environment. |
| `src/lib/supabase.ts` | Re-export the same silent logger without creating another Supabase client. |
| `src/lib/retired-storage.ts` | Remove the 410 short-circuit while preserving existing fetch/Auth code. |
| `src/routes/api/internal/r2-backfill.ts` | Successful compatibility acknowledgement, without DB, Storage or network activity. |
| `supabase/functions/migrate-storage-assets/index.ts` | Change obsolete migration response from 410 to 200; no migration activity. |
| `supabase/functions/verify-storage-assets/index.ts` | Change obsolete migration response from 410 to 200; no migration activity. |
| `supabase/functions/recover-storage-assets/index.ts` | Change obsolete migration response from 410 to 200; no migration activity. |
| `supabase/functions/r2-source-proxy/index.ts` | Change obsolete migration response from 410 to 200; no migration activity. |
| `supabase/functions/r2-backfill-trigger/index.ts` | Change obsolete migration response from 410 to 200; no migration activity. |
| `scripts/check-storage-regression.mjs` | Verify static placeholder, repeated errors/rerenders, bounded reads, successful legacy responses and unchanged upload behavior. |
| `tests/usage-guards.test.mjs` | Adapt existing checks to the static PNG and successful fallback redirect. |
| `docs/SAFE_LOG_FIX.md` | Record findings, scope and verification. |

The deployed `courier-history-bridge` has one console call not present in the repository version. Its live code is updated only by substituting a no-op logger for that call. Every other byte of the live business/Auth implementation and its existing JWT verification setting is preserved. No repository Auth changes are made. All five legacy functions also retain their existing JWT verification setting.

Verification before push: `npm run build` passed; 19 Storage regression checks and 5 existing tests passed. Twenty repeated image errors cause one placeholder assignment, and parent rerenders cannot reintroduce the failed source. The Auth clients, DB business functions and R2 upload are unchanged. Existing typecheck diagnostics are compared against main; unrelated type errors are outside this change.

## What the 131.553 GB metric means

Supabase Logs Query measures bytes scanned when logs are read by Studio, Management API, CLI or other interfaces. Repeated queries scan the same data again. It does not measure generated console logs. No Logs API polling exists in this application or its workflows. The exact external reader responsible for the historical usage is not established.

Silencing application console calls and stopping storage/image retries cannot guarantee zero Log Query growth if someone keeps reading logs. Supabase services also generate their own logs, so zero Log Ingestion is not a promise this patch can make. No logs queries were run during this repair.

The earlier usage screenshot showed a billing cycle of 26 September–26 October. Do not assume the counter resets on 1 October; use the actual period in the dashboard. Already accumulated usage is not removed by a code patch.

Primary references: https://supabase.com/docs/guides/platform/manage-your-usage/logs-query and https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest.
