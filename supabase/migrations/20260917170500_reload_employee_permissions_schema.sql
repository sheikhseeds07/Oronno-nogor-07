-- Ensure PostgREST immediately reloads the employee permission schema.
-- The permission columns already exist; this migration does not alter or remove any data.
-- This fixes stale schema-cache errors such as: Could not find the 'banners' column
-- of 'employee_permissions' in the schema cache.
NOTIFY pgrst, 'reload schema';
