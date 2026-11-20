-- Keep one canonical checkout RPC signature. The newer 9-argument
-- function includes p_alternative_phone with a default value, so legacy
-- 7/8-argument overloads make PostgREST named-argument resolution ambiguous.
DROP FUNCTION IF EXISTS public.place_public_order(text, text, text, numeric, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.place_public_order(text, text, text, numeric, jsonb, text, text);
