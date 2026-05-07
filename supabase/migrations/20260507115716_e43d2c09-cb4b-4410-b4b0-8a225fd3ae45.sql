
-- Cache des recherches
CREATE TABLE public.job_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  raw_jobs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX idx_job_search_cache_key ON public.job_search_cache(cache_key);
CREATE INDEX idx_job_search_cache_expires ON public.job_search_cache(expires_at);
ALTER TABLE public.job_search_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cache readable by authenticated"
  ON public.job_search_cache FOR SELECT TO authenticated USING (true);

-- Alertes
CREATE TABLE public.job_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  location text NOT NULL,
  country_code text NOT NULL DEFAULT 'TN',
  keywords text,
  work_type text DEFAULT 'any',
  contract text DEFAULT 'any',
  seniority text DEFAULT 'any',
  min_score int NOT NULL DEFAULT 70,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own alerts" ON public.job_alerts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Matches alertes
CREATE TABLE public.job_alert_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.job_alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  job_title text NOT NULL,
  company text NOT NULL,
  job_url text NOT NULL,
  score int NOT NULL,
  summary text,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_matches_user ON public.job_alert_matches(user_id, created_at DESC);
ALTER TABLE public.job_alert_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own matches" ON public.job_alert_matches
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own matches" ON public.job_alert_matches
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Brouillons de candidatures (CV+LM générés auto)
CREATE TABLE public.application_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_title text NOT NULL,
  company text NOT NULL,
  job_url text,
  match_score int,
  tailored_cv text,
  cover_letter text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_drafts_user ON public.application_drafts(user_id, created_at DESC);
ALTER TABLE public.application_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own drafts" ON public.application_drafts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_app_drafts_updated_at
  BEFORE UPDATE ON public.application_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
