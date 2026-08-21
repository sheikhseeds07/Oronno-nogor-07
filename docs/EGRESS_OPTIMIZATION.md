# Egress Optimization Baseline

This repository uses Cloudflare as the public media cache in front of Supabase Storage.

## Required invariants
- Public Supabase Storage image URLs must be converted to same-domain `/media?src=...` URLs.
- `/media` must validate the Supabase hostname and `/storage/v1/` path.
- Cache identity must use the stable storage object path, not signed URL tokens.
- Media responses must be publicly cacheable for a long TTL and marked immutable.
- Simultaneous misses for the same asset must be coalesced where possible.
- Public image rendering must not use Supabase `/render/image` transforms or multi-width srcsets.
- Dynamic order, checkout, visitor, and admin API requests must NOT be cached as public media.
- `wrangler.jsonc` must keep `/media` in `run_worker_first` and Cloudflare cache enabled.

## Current baseline files
- `src/lib/storage-upload.ts`
- `src/lib/img.ts`
- `src/routes/media.ts`
- `wrangler.jsonc`

## Goal
Minimize Supabase Storage origin transfer. A 5 GB/month target is a traffic-dependent goal, not a guaranteed quota: usage must be verified from Supabase/Cloudflare telemetry after deployment.
