# Direct R2 migration — 2026-09-30

Executed directly through the S3 API, bypassing GitHub Actions.

Bucket: `sheikhseeds`
Prefix: `public-assets/`

```text
[R2 ACCESS OK] existing public assets: 0
[SUMMARY] {"uploaded":33,"verifiedPrefixCount":33}
```

Uploaded all 28 files from `public/` and 5 files from `src/assets/` to `public-assets/src-assets/`. Every upload was verified with HeadObject and matching ContentLength; final ListObjectsV2 returned 33 objects.

Supabase Storage migration and database URL rewrites were not executed: SUPABASE_SERVICE_ROLE_KEY was unavailable in this execution environment. GitHub Actions secrets cannot be read back via the GitHub API. No Supabase objects were deleted. This report does not claim all 86 assets are migrated or that production has switched to R2.
