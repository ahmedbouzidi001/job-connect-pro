
-- Fix critical: profiles table exposed sensitive columns to public anonymous
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;

-- Owner can read own full profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Authenticated users (recruiters) can see profiles marked as recruiter-visible
-- (server-side queries in recruiter.functions.ts always project safe columns)
CREATE POLICY "Recruiter-visible profiles readable by authenticated"
ON public.profiles FOR SELECT
TO authenticated
USING (recruiter_visible = true);
