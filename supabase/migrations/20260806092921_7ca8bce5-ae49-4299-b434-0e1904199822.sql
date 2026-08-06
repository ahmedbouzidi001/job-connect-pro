ALTER TABLE public.auto_apply_settings
  ADD COLUMN IF NOT EXISTS daily_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_daily_run_date date;