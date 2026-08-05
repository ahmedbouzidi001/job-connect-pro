CREATE TABLE public.auto_apply_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  countries TEXT[] NOT NULL DEFAULT ARRAY['TN']::text[],
  max_per_run INTEGER NOT NULL DEFAULT 5,
  min_score INTEGER NOT NULL DEFAULT 50,
  role_override TEXT,
  last_run_at TIMESTAMP WITH TIME ZONE,
  total_applied INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_apply_settings TO authenticated;
GRANT ALL ON public.auto_apply_settings TO service_role;

ALTER TABLE public.auto_apply_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own auto-apply settings"
ON public.auto_apply_settings FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_auto_apply_settings_updated_at
BEFORE UPDATE ON public.auto_apply_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();