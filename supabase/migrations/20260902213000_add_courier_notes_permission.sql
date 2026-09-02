ALTER TABLE public.employee_permissions
  ADD COLUMN IF NOT EXISTS courier_notes BOOLEAN NOT NULL DEFAULT false;

-- Courier Notes is intentionally opt-in: existing employees remain unchanged.
COMMENT ON COLUMN public.employee_permissions.courier_notes IS 'Allows employee to access the Courier Notes / Rescue Center.';
