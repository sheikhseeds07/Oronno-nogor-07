-- Correct today's NUTRIMIX orders that were saved with the general ৳50 fee
-- while the published landing package explicitly had free delivery.
UPDATE public.orders AS o
SET delivery_fee = 0,
    total = o.subtotal
WHERE o.created_at >= TIMESTAMPTZ '2026-10-01 00:00:00+00'
  AND o.delivery_fee = 50
  AND o.subtotal = 499
  AND o.total = 549
  AND EXISTS (
    SELECT 1
    FROM public.order_items AS oi
    WHERE oi.order_id = o.id
      AND oi.product_name = 'NUTRIMIX 200 GM + ২৪ প্রকার বীজ ফ্রী '
      AND oi.price = 499
      AND oi.quantity = 1
  );