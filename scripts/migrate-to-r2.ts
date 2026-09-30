// Kept as a fail-closed entry point for old commands. No network or DB writes.
process.stderr.write("Retired: Supabase Storage migration is disabled. Use Cloudflare R2 media endpoints.\n");
process.exitCode = 1;
export {};
