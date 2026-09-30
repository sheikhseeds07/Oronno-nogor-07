// The completed Storage migration must never run again or rewrite media rows.
process.stderr.write("Retired: Supabase Storage migration is disabled. Use Cloudflare R2 media endpoints.\n");
process.exitCode = 1;
