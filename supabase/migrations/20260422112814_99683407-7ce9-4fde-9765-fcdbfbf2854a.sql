
-- Enums
CREATE TYPE public.app_role AS ENUM ('candidate', 'recruiter', 'admin');
CREATE TYPE public.market_type AS ENUM ('tunisia', 'international', 'both');
CREATE TYPE public.work_type AS ENUM ('remote', 'hybrid', 'onsite');
CREATE TYPE public.employment_type AS ENUM ('full_time', 'part_time', 'contract', 'internship', 'freelance');
CREATE TYPE public.application_status AS ENUM ('saved', 'applied', 'interview', 'offer', 'rejected');

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- USER ROLES (separate table, never on profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  headline TEXT,
  bio TEXT,
  avatar_url TEXT,
  location TEXT,
  country_code TEXT,
  market_preference market_type DEFAULT 'both',
  preferred_language TEXT DEFAULT 'fr',
  target_role TEXT,
  experience_years INT DEFAULT 0,
  skills TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  links JSONB DEFAULT '{}',
  employability_score INT,
  cv_url TEXT,
  cv_raw_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, preferred_language)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'fr'));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'candidate');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- JOBS
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_logo_url TEXT,
  location TEXT,
  country_code TEXT,
  market market_type DEFAULT 'both',
  work_type work_type DEFAULT 'onsite',
  employment_type employment_type DEFAULT 'full_time',
  description TEXT,
  required_skills TEXT[] DEFAULT '{}',
  salary_min INT,
  salary_max INT,
  salary_currency TEXT DEFAULT 'TND',
  source_url TEXT,
  source_name TEXT,
  external_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  posted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active jobs viewable by everyone" ON public.jobs FOR SELECT USING (is_active = true OR posted_by = auth.uid());
CREATE POLICY "Recruiters can insert jobs" ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = posted_by AND (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Owners or admins can update jobs" ON public.jobs FOR UPDATE
  USING (auth.uid() = posted_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners or admins can delete jobs" ON public.jobs FOR DELETE
  USING (auth.uid() = posted_by OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_jobs_market ON public.jobs(market) WHERE is_active = true;
CREATE INDEX idx_jobs_country ON public.jobs(country_code) WHERE is_active = true;

-- APPLICATIONS
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  job_url TEXT,
  status application_status NOT NULL DEFAULT 'saved',
  match_score INT,
  notes TEXT,
  cover_letter TEXT,
  applied_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own applications" ON public.applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own applications" ON public.applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own applications" ON public.applications FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_applications_user_status ON public.applications(user_id, status);

-- CV ANALYSES
CREATE TABLE public.cv_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cv_text TEXT,
  score INT,
  summary TEXT,
  strengths JSONB DEFAULT '[]',
  gaps JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  market_positioning TEXT,
  language TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cv_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own analyses" ON public.cv_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analyses" ON public.cv_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses" ON public.cv_analyses FOR DELETE USING (auth.uid() = user_id);

-- STORAGE: private CV bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', false);
CREATE POLICY "Users can read own CVs" ON storage.objects FOR SELECT
  USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own CVs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own CVs" ON storage.objects FOR UPDATE
  USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own CVs" ON storage.objects FOR DELETE
  USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);
