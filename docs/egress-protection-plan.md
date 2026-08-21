# Egress protection

Implementation is maintained in the application code. This file documents that public Supabase media must be served via `/media`, dynamic/admin/API responses must remain `no-store`, and new image uploads are optimized before Storage upload.
