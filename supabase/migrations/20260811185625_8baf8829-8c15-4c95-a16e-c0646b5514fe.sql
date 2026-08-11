DELETE FROM public.order_items WHERE order_id = 'debd2477-4e9f-4cef-be9d-8f1d2029b172';
DELETE FROM public.order_status_logs WHERE order_id = 'debd2477-4e9f-4cef-be9d-8f1d2029b172';
DELETE FROM public.orders WHERE id = 'debd2477-4e9f-4cef-be9d-8f1d2029b172';
DELETE FROM public.incomplete_orders WHERE phone = '01712345678';
DELETE FROM public.incomplete_events WHERE phone = '01712345678';