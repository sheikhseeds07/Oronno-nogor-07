CREATE OR REPLACE FUNCTION public.get_my_customer_order_detail(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT jsonb_build_object(
    'id', o.id,
    'invoice_no', o.invoice_no,
    'status', o.status,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'customer_address', o.customer_address,
    'thana', o.thana,
    'district', o.district,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'courier_display_name', o.courier_display_name,
    'courier_consignment', o.courier_consignment,
    'order_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'price', oi.price,
        'subtotal', oi.subtotal
      ) ORDER BY oi.id)
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o
  WHERE o.id = p_order_id
    AND (
      o.created_by = auth.uid()
      OR regexp_replace(COALESCE(o.customer_phone,''), '[^0-9]', '', 'g') = regexp_replace(COALESCE((SELECT u.phone FROM auth.users u WHERE u.id = auth.uid()), ''), '[^0-9]', '', 'g')
      OR regexp_replace(COALESCE(o.customer_phone,''), '[^0-9]', '', 'g') = regexp_replace(COALESCE((SELECT cp.phone FROM public.customer_profiles cp WHERE cp.id = auth.uid()), ''), '[^0-9]', '', 'g')
    );
$$;

REVOKE ALL ON FUNCTION public.get_my_customer_order_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_customer_order_detail(uuid) TO authenticated;
