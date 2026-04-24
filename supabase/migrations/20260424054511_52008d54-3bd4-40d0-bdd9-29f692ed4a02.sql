-- 1) Branches table
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_owner_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX branches_business_idx ON public.branches(business_owner_id);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business branches"
ON public.branches
FOR ALL
USING (business_owner_id = public.get_business_owner(auth.uid()))
WITH CHECK (business_owner_id = public.get_business_owner(auth.uid()));

CREATE TRIGGER branches_touch
BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Multi-branch toggle on profile + active branch on user_roles (per staff)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS multi_branch_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS active_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 3) Per-branch receipt settings
ALTER TABLE public.receipt_settings
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;

-- Drop the old per-business UNIQUE so we can have one default + one per branch.
ALTER TABLE public.receipt_settings
  DROP CONSTRAINT IF EXISTS receipt_settings_business_owner_id_key;

-- One settings row per (business, branch). NULL branch = business default.
CREATE UNIQUE INDEX IF NOT EXISTS receipt_settings_business_branch_uniq
  ON public.receipt_settings(business_owner_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Validation: if branch_id is set, it must belong to the same business.
CREATE OR REPLACE FUNCTION public.validate_receipt_settings_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE owner uuid;
BEGIN
  IF NEW.branch_id IS NULL THEN RETURN NEW; END IF;
  SELECT business_owner_id INTO owner FROM public.branches WHERE id = NEW.branch_id;
  IF owner IS NULL OR owner <> NEW.business_owner_id THEN
    RAISE EXCEPTION 'branch_id % does not belong to business %', NEW.branch_id, NEW.business_owner_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS receipt_settings_branch_check ON public.receipt_settings;
CREATE TRIGGER receipt_settings_branch_check
BEFORE INSERT OR UPDATE ON public.receipt_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_receipt_settings_branch();