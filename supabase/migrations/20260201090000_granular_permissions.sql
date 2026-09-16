-- Granular CEO-controlled permissions: add per-feature columns.
ALTER TABLE public.employee_permissions
  ADD COLUMN IF NOT EXISTS order_import boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_orders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_division boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_rate_limit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS courier boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_management boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_feedback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_seeds boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_ad_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS integrations boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attendance boolean NOT NULL DEFAULT false;
