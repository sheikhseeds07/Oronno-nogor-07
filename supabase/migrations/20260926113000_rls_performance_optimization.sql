-- Performance-only RLS optimization: cache auth.uid() once per statement.
-- This preserves the existing authorization logic and does not change application behavior.
-- Applied directly to production on 2026-09-26.

-- The production policies were rewritten in-place by replacing row-by-row auth.uid()
-- evaluation with (select auth.uid()). Keep this migration as documentation for schema drift.

-- Duplicate site_visitors last_seen index was also removed; the remaining identical index
-- is site_visitors_last_seen_idx (or its equivalent created by the project).
