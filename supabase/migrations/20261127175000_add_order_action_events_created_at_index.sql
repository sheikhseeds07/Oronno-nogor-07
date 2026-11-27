-- Speeds up date-window scans across all order action events used by dashboard analytics.
-- Concurrent creation avoids blocking live order confirmations/cancellations.
CREATE INDEX CONCURRENTLY IF NOT EXISTS order_action_events_created_at_idx
  ON public.order_action_events (created_at);
