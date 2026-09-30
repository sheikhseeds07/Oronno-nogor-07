# শেখ সিড — Sheikh Seeds

বাংলাদেশের অনলাইন বীজ ও গার্ডেন টুলস ই-কমার্স ওয়েবসাইট।

সাইট: https://sheikhseeds.com

## Tech

- TanStack Start (React 19 + Vite)
- Tailwind CSS
- Supabase (database, auth, storage)
- Cloudflare Workers (deploy)

## Development

```bash
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```

`.env.example` দেখে `.env` ফাইল তৈরি করুন।

## Build

```bash
bun run build
```

Deployment is handled by the Cloudflare Workers Git integration from the `main` branch.

## Usage protection (2026-09-30)

This is TanStack Start/Vite on Cloudflare Workers, not Next.js. Do not add
`next/image`, Next.js `force-static`, or Vercel cron configuration here.

- Log Query is bytes **scanned when reading logs**, not console output or DB reads.
  Never leave Dashboard > Logs auto-refreshing unnecessarily. Stop scripted
  log polling, use short time windows, and close unused Logs tabs. This app cannot
  disable dashboard auto-fetch. No log-query endpoint is used by this application.
- Free quotas are separate: Log Query allowance 100 GB, uncached Egress 5 GB,
  cached Egress 5 GB. Alert targets here are 10 GB Log Query and 4 GB per egress
  category. Adding them into a single 80 GB budget is unsafe.
- `src/lib/logger.ts` is silent in production. Offline migration/build scripts
  under `scripts/` are the only allowed console output; they do not run per request.
- R2 uploads use `storage-upload.ts` -> `/api/media/upload` -> the existing
  `cloudflare-r2.server.ts` binding utility (`MEDIA_BUCKET`). Missing R2 objects
  return 404. Image failures display an inline placeholder, with no origin retry.
  Old Storage URLs are parsed only to map existing DB rows to R2 keys.
- Completed migration/source/recovery endpoints return 410 without any upstream
  request. Deploy the corresponding Edge Functions to retire existing versions.
  Offline migration scripts remain manual operator tools, not application paths.
- React Query caches reads for five minutes by default with automatic retries
  disabled. Known redundant dashboard polling/realtime refresh was removed.
  Operational order subscriptions and lock heartbeats remain for correctness.
  Courier synchronization on the shipped-order screen runs at most every 15 min.
- Public catalog cache misses and uploads have bounded **per-isolate** limits;
  chat has a per-isolate limit and does not retry 429/5xx against another model.
  These do not enforce a global budget across Worker/Edge isolates. Configure
  provider-side distributed rate limits for protection against sustained abuse.
- Explicit read projections preserve all fields needed by full admin editors;
  they do not magically reduce payloads when the full editor record is required.
  Customer-specific/authenticated reads must never use a shared public cache.
- Review unused Log Drains under the project settings and remove them if not
  needed. Drains stream logs; disabling one does not stop dashboard log scans.
  Drains have not been inspected or changed by this code patch.

### Usage check limitations and operations

`node scripts/check-usage.ts --snapshot=/secure/usage.json` checks Management API
access and validates a fresh billing snapshot. Set `SUPABASE_ACCESS_TOKEN` only
in a secure job environment, never a VITE variable. Snapshot format:

```json
{"projectRef":"frtzlibogmethppqmhtr","observedAt":"2026-09-30T15:00:00Z","logQueryGB":47.556,"uncachedEgressGB":0.349,"cachedEgressGB":0}
```

Supply real measurements for **all** fields; the example is not live evidence.
The public Management API documentation reviewed does not expose a verified
billing-total endpoint for these three GB metrics. The checker deliberately
fails when the snapshot is missing/stale, rather than inventing an API or
reporting zero. Exit 1 means a threshold alert; exit 2 means monitoring failed.
Production verbose logs are already disabled unconditionally, so no delayed
monitor action is needed to silence them. This script cannot turn off platform
logs, dashboard polling, or already deployed code in another environment.

Daily unattended monitoring and external alert delivery are **not activated**:
they require a supported billing data feed plus a configured scheduler and alert
destination. A daily check is not a hard cap and can miss a same-day spike.
No code patch can guarantee usage never crosses 80 GB while direct platform
access, dashboard queries, multiple clients and network traffic remain possible.

Verification: `node --test tests/usage-guards.test.mjs`; full build via existing
GitHub Build Check. Before release, also verify authenticated admin edits,
checkout, product media and an intentional missing-R2 object against staging.

References:
- https://supabase.com/docs/guides/platform/manage-your-usage/logs-query
- https://supabase.com/docs/guides/platform/manage-your-usage/egress
- https://supabase.com/docs/reference/api/introduction
