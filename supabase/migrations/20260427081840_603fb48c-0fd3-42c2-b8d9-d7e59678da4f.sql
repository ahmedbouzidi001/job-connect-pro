
-- Profile enrichments
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv_structured jsonb,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email_contact text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS preferred_template text DEFAULT 'modern',
  ADD COLUMN IF NOT EXISTS recruiter_visible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_country text;

-- Application enrichments
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS tailored_cv text,
  ADD COLUMN IF NOT EXISTS keywords text[];

-- Conversations between users
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null,
  recruiter_id uuid not null,
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, recruiter_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants can view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = candidate_id OR auth.uid() = recruiter_id);

CREATE POLICY "recruiters or candidates can create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = candidate_id OR auth.uid() = recruiter_id);

CREATE POLICY "participants can update conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = candidate_id OR auth.uid() = recruiter_id);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages(conversation_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.candidate_id = auth.uid() OR c.recruiter_id = auth.uid())
  ));

CREATE POLICY "participants can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.candidate_id = auth.uid() OR c.recruiter_id = auth.uid())
    )
  );

CREATE POLICY "sender can update read"
  ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.candidate_id = auth.uid() OR c.recruiter_id = auth.uid())
  ));

-- Learning paths (skills + certifs recommandés)
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  target_role text,
  gaps jsonb default '[]'::jsonb,
  recommendations jsonb default '[]'::jsonb,
  language text default 'fr',
  created_at timestamptz not null default now()
);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own learning paths"
  ON public.learning_paths FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers updated_at
DROP TRIGGER IF EXISTS conversations_set_updated_at ON public.conversations;
CREATE TRIGGER conversations_set_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
