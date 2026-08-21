EGRESS OPTIMIZATION BASELINE

Do not remove or bypass: src/lib/storage-upload.ts, src/lib/img.ts, src/routes/media.ts, wrangler.jsonc cache configuration.

Public Supabase Storage images must be served through /media. Cache key must be stable by object path, not signed URL token. Do not publicly cache dynamic order/checkout/visitor/admin APIs.

5 GB/month is a traffic-dependent target, not a guaranteed quota; verify telemetry after deployment.
