
-- Premium flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_until timestamptz;

-- Jobs: internal flag + nice-to-have
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nice_to_have_skills text[] DEFAULT '{}'::text[];

-- Application status enum (extend if needed)
DO $$ BEGIN
  CREATE TYPE public.job_app_status AS ENUM ('new','contacted','interview','offer','rejected','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- job_applications table (candidatures internes aux offres publiées sur la plateforme)
CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  recruiter_id uuid NOT NULL,
  status public.job_app_status NOT NULL DEFAULT 'new',
  match_score integer,
  match_reason text,
  cover_message text,
  cv_snapshot jsonb,
  recruiter_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate can view own applications" ON public.job_applications
  FOR SELECT TO authenticated USING (auth.uid() = candidate_id);

CREATE POLICY "recruiter can view applications on own jobs" ON public.job_applications
  FOR SELECT TO authenticated USING (auth.uid() = recruiter_id);

CREATE POLICY "candidate can apply" ON public.job_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = candidate_id);

CREATE POLICY "recruiter can update applications on own jobs" ON public.job_applications
  FOR UPDATE TO authenticated USING (auth.uid() = recruiter_id);

CREATE POLICY "candidate can withdraw" ON public.job_applications
  FOR UPDATE TO authenticated USING (auth.uid() = candidate_id);

CREATE POLICY "candidate can delete own" ON public.job_applications
  FOR DELETE TO authenticated USING (auth.uid() = candidate_id);

CREATE TRIGGER trg_job_apps_updated
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_job_apps_job ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_apps_candidate ON public.job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_apps_recruiter ON public.job_applications(recruiter_id);

-- Avatars bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars','avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Helper: ensure_recruiter_role -> grants recruiter role on first job post
CREATE OR REPLACE FUNCTION public.ensure_recruiter_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.posted_by IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.posted_by, 'recruiter')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_grant_recruiter ON public.jobs;
CREATE TRIGGER trg_jobs_grant_recruiter
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.ensure_recruiter_role();
