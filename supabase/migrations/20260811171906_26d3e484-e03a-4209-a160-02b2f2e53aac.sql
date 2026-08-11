-- Replace Alhamdulillah chat schema with Sheikh Seeds schema
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.bump_conversation() CASCADE;
DROP FUNCTION IF EXISTS public.is_participant(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'employee', 'customer');
CREATE TYPE public.order_status AS ENUM ('web_pending','pending','rts','shipped','delivered','pending_return','returned','partial','cancelled','hold');
CREATE TYPE public.order_source AS ENUM ('web','manual');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, phone TEXT, address TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.employee_permissions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  orders BOOLEAN NOT NULL DEFAULT false,
  web_orders BOOLEAN NOT NULL DEFAULT false,
  new_order BOOLEAN NOT NULL DEFAULT false,
  products BOOLEAN NOT NULL DEFAULT false,
  categories BOOLEAN NOT NULL DEFAULT false,
  customers BOOLEAN NOT NULL DEFAULT false,
  delivery BOOLEAN NOT NULL DEFAULT false,
  marketing BOOLEAN NOT NULL DEFAULT false,
  reports BOOLEAN NOT NULL DEFAULT false,
  settings BOOLEAN NOT NULL DEFAULT false,
  hrm BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin','employee')) $$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin')) $$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE allowed BOOLEAN; sql TEXT;
BEGIN
  IF public.is_admin(_user_id) THEN RETURN true; END IF;
  IF _module !~ '^[a-z_]+$' THEN RETURN false; END IF;
  sql := format('SELECT COALESCE(%I, false) FROM public.employee_permissions WHERE user_id = $1', _module);
  EXECUTE sql INTO allowed USING _user_id;
  RETURN COALESCE(allowed, false);
END $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_emp_perms BEFORE UPDATE ON public.employee_permissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  image_url TEXT, display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, sku TEXT,
  description TEXT, short_description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(10,2),
  stock INT NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  images TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER touch_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT UNIQUE,
  source public.order_source NOT NULL DEFAULT 'web',
  status public.order_status NOT NULL DEFAULT 'web_pending',
  customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
  customer_address TEXT, thana TEXT, district TEXT, notes TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 50,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code TEXT, payment_method TEXT,
  courier_status TEXT, courier_consignment TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER touch_orders BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'flat',
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order NUMERIC(10,2) NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT, image_url TEXT NOT NULL, link_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  hero_title TEXT, hero_subtitle TEXT, hero_image TEXT,
  cta_text TEXT DEFAULT 'অর্ডার করুন',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER touch_integrations BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER touch_site_settings BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, phone TEXT, email TEXT, position TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- policies
CREATE POLICY "profiles_self_or_staff_read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "emp_perms_self_read" ON public.employee_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "emp_perms_admin_write" ON public.employee_permissions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "categories_public_read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_admin_write" ON public.categories FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'categories')) WITH CHECK (public.has_permission(auth.uid(),'categories'));

CREATE POLICY "products_public_read" ON public.products FOR SELECT TO anon, authenticated USING (is_active = true OR public.is_staff(auth.uid()));
CREATE POLICY "products_admin_write" ON public.products FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'products')) WITH CHECK (public.has_permission(auth.uid(),'products'));

CREATE POLICY "orders_staff_read" ON public.orders FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'orders') OR created_by = auth.uid());
CREATE POLICY "orders_public_create" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "orders_staff_update" ON public.orders FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(),'orders')) WITH CHECK (public.has_permission(auth.uid(),'orders'));
CREATE POLICY "orders_admin_delete" ON public.orders FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "order_items_read" ON public.order_items FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'orders') OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.created_by = auth.uid()));
CREATE POLICY "order_items_public_create" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "order_items_staff_write" ON public.order_items FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'orders')) WITH CHECK (public.has_permission(auth.uid(),'orders'));

CREATE POLICY "order_logs_staff_read" ON public.order_status_logs FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'orders'));
CREATE POLICY "order_logs_staff_write" ON public.order_status_logs FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'orders'));

CREATE POLICY coupons_staff_read ON public.coupons FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'marketing') OR public.is_admin(auth.uid()));
CREATE POLICY "coupons_admin_write" ON public.coupons FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'marketing')) WITH CHECK (public.has_permission(auth.uid(),'marketing'));

CREATE POLICY "banners_public_read" ON public.banners FOR SELECT TO anon, authenticated USING (is_active = true OR public.is_staff(auth.uid()));
CREATE POLICY "banners_admin_write" ON public.banners FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'marketing')) WITH CHECK (public.has_permission(auth.uid(),'marketing'));

CREATE POLICY "landing_public_read" ON public.landing_pages FOR SELECT TO anon, authenticated USING (is_published = true OR public.is_staff(auth.uid()));
CREATE POLICY "landing_admin_write" ON public.landing_pages FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'marketing')) WITH CHECK (public.has_permission(auth.uid(),'marketing'));

CREATE POLICY "integrations_admin" ON public.integrations FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "site_settings_public_read" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "site_settings_admin_write" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "employees_admin" ON public.employees FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- invoice numbering
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START WITH 8000;

CREATE OR REPLACE FUNCTION public.assign_invoice_no()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.invoice_no IS NULL AND NEW.status <> 'web_pending' THEN
    NEW.invoice_no := 'SK' || nextval('public.invoice_seq');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_invoice_no_trg ON public.orders;
CREATE TRIGGER orders_invoice_no_trg
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_invoice_no();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ;

-- Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  check_in timestamptz NOT NULL DEFAULT now(),
  check_out timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, check_in DESC);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_self_read ON public.attendance FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY attendance_self_insert ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY attendance_self_update ON public.attendance FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY attendance_admin_delete ON public.attendance FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- Phone OTP (server-only via service role)
CREATE TABLE IF NOT EXISTS public.phone_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone_recent ON public.phone_otp_codes(phone, created_at DESC);
ALTER TABLE public.phone_otp_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

ALTER TABLE public.employee_permissions ADD COLUMN IF NOT EXISTS landing_pages boolean NOT NULL DEFAULT false;
ALTER TABLE public.employee_permissions ADD COLUMN IF NOT EXISTS all_api boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.incomplete_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  customer_name text,
  customer_address text,
  delivery_zone text,
  delivery_fee numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incomplete_orders_phone ON public.incomplete_orders(phone);
CREATE INDEX IF NOT EXISTS idx_incomplete_orders_updated ON public.incomplete_orders(updated_at DESC);
ALTER TABLE public.incomplete_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incomplete_orders_staff_read" ON public.incomplete_orders
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'orders') OR public.has_permission(auth.uid(), 'web_orders'));
CREATE POLICY "incomplete_orders_staff_delete" ON public.incomplete_orders
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'orders') OR public.has_permission(auth.uid(), 'web_orders'));
CREATE POLICY "incomplete_orders_staff_update" ON public.incomplete_orders
  FOR UPDATE TO authenticated
  USING (has_permission(auth.uid(), 'orders') OR has_permission(auth.uid(), 'web_orders'))
  WITH CHECK (has_permission(auth.uid(), 'orders') OR has_permission(auth.uid(), 'web_orders'));

CREATE TRIGGER incomplete_orders_touch
  BEFORE UPDATE ON public.incomplete_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS gallery_images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS regular_price numeric,
  ADD COLUMN IF NOT EXISTS sale_price numeric,
  ADD COLUMN IF NOT EXISTS delivery_inside numeric NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS delivery_outside numeric NOT NULL DEFAULT 130,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reviews jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#16a34a',
  ADD COLUMN IF NOT EXISTS show_reviews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_faq boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_features boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS seeds_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS guarantee_text text,
  ADD COLUMN IF NOT EXISTS planting_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS top_bar_text text,
  ADD COLUMN IF NOT EXISTS why_choose_us jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS main_delivery_fee numeric;

CREATE TABLE IF NOT EXISTS public.order_locks (
  order_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  user_name text,
  locked_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_locks_staff_read" ON public.order_locks
  FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'orders'));
CREATE POLICY "order_locks_admin_delete" ON public.order_locks
  FOR DELETE TO authenticated USING (is_admin(auth.uid()) OR user_id = auth.uid());
CREATE INDEX IF NOT EXISTS order_locks_heartbeat_idx ON public.order_locks(heartbeat_at);

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_hidden_from_home boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "site_assets_public_read" ON storage.objects;
CREATE POLICY "site_assets_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'site-assets' AND name IS NOT NULL);

DROP POLICY IF EXISTS "site_assets_staff_insert" ON storage.objects;
CREATE POLICY "site_assets_staff_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'site-assets' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "site_assets_staff_update" ON storage.objects;
CREATE POLICY "site_assets_staff_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'site-assets' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'site-assets' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "site_assets_admin_delete" ON storage.objects;
CREATE POLICY "site_assets_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));

-- indexes
CREATE INDEX IF NOT EXISTS idx_categories_home_order ON public.categories (is_hidden_from_home, display_order);
CREATE INDEX IF NOT EXISTS idx_products_active_created ON public.products (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON public.products (category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_active_stock ON public.products (is_active, stock);
CREATE INDEX IF NOT EXISTS idx_banners_active_order ON public.banners (is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_courier_consignment ON public.orders(courier_consignment) WHERE courier_consignment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON public.orders (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured, is_active);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_order ON public.order_status_logs (order_id, created_at DESC);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incomplete_orders;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.incomplete_orders REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS public.incomplete_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  event text NOT NULL CHECK (event IN ('created','cancelled','converted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incomplete_events_created_at ON public.incomplete_events(created_at);
CREATE INDEX IF NOT EXISTS idx_incomplete_events_event_created ON public.incomplete_events(event, created_at);
CREATE INDEX IF NOT EXISTS idx_incomplete_events_phone_created ON public.incomplete_events (phone, created_at DESC);
ALTER TABLE public.incomplete_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incomplete_events_staff_read" ON public.incomplete_events
  FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'orders') OR has_permission(auth.uid(), 'web_orders'));
CREATE POLICY "incomplete_events_public_insert" ON public.incomplete_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_orders_phone_status ON public.orders(customer_phone, status);
CREATE INDEX IF NOT EXISTS idx_orders_source_created_at ON public.orders(source, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_updated_at ON public.orders(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_landing_pages_product_id ON public.landing_pages(product_id) WHERE product_id IS NOT NULL;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.top_selling_products AS
SELECT
  oi.product_id,
  SUM(oi.quantity)::bigint AS total_sold,
  COUNT(DISTINCT oi.order_id)::bigint AS order_count
FROM public.order_items oi
WHERE oi.product_id IS NOT NULL
  AND oi.product_id NOT IN (SELECT product_id FROM public.landing_pages WHERE product_id IS NOT NULL)
GROUP BY oi.product_id
ORDER BY total_sold DESC
LIMIT 50;

CREATE UNIQUE INDEX IF NOT EXISTS idx_top_selling_products_pid ON public.top_selling_products(product_id);

CREATE OR REPLACE FUNCTION public.refresh_top_selling_products()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.top_selling_products;
END;
$$;

REVOKE ALL ON public.top_selling_products FROM anon, authenticated;
GRANT SELECT ON public.top_selling_products TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_top_selling_products() FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  path text,
  referrer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_visits_public_insert" ON public.site_visits FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "site_visits_staff_read" ON public.site_visits FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON public.site_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visits_session ON public.site_visits (session_id, created_at);

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon, authenticated;

-- Facebook messenger inbox
ALTER TYPE public.order_source ADD VALUE IF NOT EXISTS 'messenger';
ALTER TABLE public.employee_permissions ADD COLUMN IF NOT EXISTS messages boolean NOT NULL DEFAULT false;

CREATE TABLE public.fb_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id text NOT NULL,
  psid text NOT NULL,
  customer_name text,
  customer_phone text,
  last_message_at timestamp with time zone NOT NULL DEFAULT now(),
  last_message_text text,
  unread_count integer NOT NULL DEFAULT 0,
  ai_enabled boolean NOT NULL DEFAULT true,
  ai_paused_until timestamp with time zone,
  status text NOT NULL DEFAULT 'open',
  needs_human boolean NOT NULL DEFAULT false,
  last_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (page_id, psid)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_conversations TO authenticated;
GRANT ALL ON public.fb_conversations TO service_role;
ALTER TABLE public.fb_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_fb_conversations" ON public.fb_conversations
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff_write_fb_conversations" ON public.fb_conversations
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER touch_fb_conversations BEFORE UPDATE ON public.fb_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX fb_conversations_last_message_idx ON public.fb_conversations (last_message_at DESC);

CREATE TABLE public.fb_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.fb_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL,
  text text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  mid text,
  sent_by text,
  staff_id uuid,
  ai_handled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_messages TO authenticated;
GRANT ALL ON public.fb_messages TO service_role;
ALTER TABLE public.fb_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_fb_messages" ON public.fb_messages
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
ALTER TABLE public.fb_messages ADD CONSTRAINT fb_messages_mid_unique UNIQUE (mid);
CREATE INDEX fb_messages_conversation_idx ON public.fb_messages (conversation_id, created_at);
CREATE INDEX fb_messages_conv_handled_idx ON public.fb_messages(conversation_id, ai_handled);

CREATE TABLE public.fb_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id text NOT NULL,
  post_id text,
  comment_id text NOT NULL UNIQUE,
  parent_comment_id text,
  from_id text,
  from_name text,
  text text,
  permalink text,
  ai_reply text,
  replied boolean NOT NULL DEFAULT false,
  private_replied boolean NOT NULL DEFAULT false,
  reply_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_comments TO authenticated;
GRANT ALL ON public.fb_comments TO service_role;
ALTER TABLE public.fb_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_fb_comments" ON public.fb_comments
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX fb_comments_created_idx ON public.fb_comments (created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.fb_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fb_messages;

CREATE TABLE IF NOT EXISTS public.fb_trainer_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  learned_q TEXT,
  learned_a TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fb_trainer_messages_created_idx ON public.fb_trainer_messages (created_at);
GRANT SELECT, INSERT, DELETE ON public.fb_trainer_messages TO authenticated;
GRANT ALL ON public.fb_trainer_messages TO service_role;
ALTER TABLE public.fb_trainer_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage trainer chat" ON public.fb_trainer_messages FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.fb_locks (
  key text PRIMARY KEY,
  locked_until timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.fb_locks TO service_role;
ALTER TABLE public.fb_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.try_fb_lock(_key text, _seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE got boolean;
BEGIN
  INSERT INTO public.fb_locks (key, locked_until)
  VALUES (_key, now() + make_interval(secs => _seconds))
  ON CONFLICT (key) DO UPDATE
    SET locked_until = now() + make_interval(secs => _seconds)
    WHERE public.fb_locks.locked_until < now();
  GET DIAGNOSTICS got = ROW_COUNT;
  RETURN got;
END $$;

CREATE OR REPLACE FUNCTION public.release_fb_lock(_key text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.fb_locks SET locked_until = now() - interval '1 second' WHERE key = _key $$;

REVOKE ALL ON FUNCTION public.try_fb_lock(text, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.release_fb_lock(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_fb_lock(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_fb_lock(text) TO service_role;

-- default site settings row
INSERT INTO public.site_settings (id, settings)
SELECT gen_random_uuid(), jsonb_build_object('site_name', 'শেখ সিড')
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings);

-- Data API grants (RLS policies remain the access control layer)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
REVOKE ALL ON public.top_selling_products FROM anon, authenticated;