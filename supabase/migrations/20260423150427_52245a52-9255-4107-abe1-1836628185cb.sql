-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'cashier');

-- user_roles table (each row = one role assignment for a user, scoped by business owner)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_owner_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, business_owner_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get the business owner for the current user (themselves if owner, or their employer)
CREATE OR REPLACE FUNCTION public.get_business_owner(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT business_owner_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1),
    _user_id
  )
$$;

-- Function to get current user's highest role within their business
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'cashier' THEN 3 END
  LIMIT 1
$$;

-- RLS for user_roles
CREATE POLICY "view roles in my business" ON public.user_roles
FOR SELECT USING (
  business_owner_id = public.get_business_owner(auth.uid())
);

CREATE POLICY "admins manage roles" ON public.user_roles
FOR ALL USING (
  business_owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  business_owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

-- Auto-assign admin role to business owner on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, business_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'business_name');

  INSERT INTO public.user_roles (user_id, business_owner_id, role)
  VALUES (NEW.id, NEW.id, 'admin');

  RETURN NEW;
END; $$;

-- Create the trigger if missing
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill admin roles for existing users
INSERT INTO public.user_roles (user_id, business_owner_id, role)
SELECT id, id, 'admin' FROM auth.users
ON CONFLICT DO NOTHING;

-- Add receipt_pdf_url column to sales for storing PDFs (optional, generated client-side)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS refunded_by uuid;