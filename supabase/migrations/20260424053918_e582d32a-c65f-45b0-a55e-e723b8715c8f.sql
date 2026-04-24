-- Per-business receipt settings
CREATE TABLE public.receipt_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_owner_id uuid NOT NULL UNIQUE,
  template text NOT NULL DEFAULT 'thermal',           -- 'thermal' | 'branded'
  paper_size text NOT NULL DEFAULT 'a4',              -- 'a4' | 'receipt' (80mm)
  store_address text,
  footer_note text,
  show_barcode boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipt_settings_template_chk CHECK (template IN ('thermal','branded')),
  CONSTRAINT receipt_settings_paper_chk CHECK (paper_size IN ('a4','receipt'))
);

ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business receipt settings"
ON public.receipt_settings
FOR ALL
USING (business_owner_id = public.get_business_owner(auth.uid()))
WITH CHECK (business_owner_id = public.get_business_owner(auth.uid()));

CREATE TRIGGER receipt_settings_touch
BEFORE UPDATE ON public.receipt_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();