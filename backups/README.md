# Supabase backup workspace

This directory is intentionally tracked, but raw backup payloads are not.

Expected local outputs:
- db_full.sql
- roles.sql
- schema.sql
- data.sql
- storage_list.json
- env_backup.txt
- SHA256SUMS

Do not commit generated backup files. They can contain customer PII, password hashes, and credentials. Keep an encrypted off-repository copy before cutover.
