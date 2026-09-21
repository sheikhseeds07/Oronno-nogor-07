-- Permanently retire the coupon feature.
-- Historical order coupon_code data is intentionally retained so existing orders remain intact.
DROP TABLE IF EXISTS public.coupons CASCADE;
ALTER TABLE IF EXISTS public.employee_permissions DROP COLUMN IF EXISTS coupons;
