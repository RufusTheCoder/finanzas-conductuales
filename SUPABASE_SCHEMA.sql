-- Supabase SQL schema for questions and question metrics

-- Table: public.questions
CREATE TABLE IF NOT EXISTS public.questions (
  id serial PRIMARY KEY,
  phase text NOT NULL,
  sesgo_key text,
  module text NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL,
  correct_answer text,
  importance text NOT NULL DEFAULT 'high',
  diagnostic boolean NOT NULL DEFAULT true,
  quality_score int NOT NULL DEFAULT 0,
  response_rules jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questions_phase_idx ON public.questions (phase);
CREATE INDEX IF NOT EXISTS questions_sesgo_key_idx ON public.questions (sesgo_key);

-- Table: public.question_metrics
CREATE TABLE IF NOT EXISTS public.question_metrics (
  id serial PRIMARY KEY,
  question_id int NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  views int NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  avg_time_seconds numeric(8,2),
  confusion_rate numeric(5,4),
  feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_metrics_question_id_idx ON public.question_metrics (question_id);

-- Table: public.progress
CREATE TABLE IF NOT EXISTS public.progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bit_done jsonb,
  bit_result text,
  bit_answers jsonb,
  sesgos jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS progress_user_id_idx ON public.progress (user_id);

-- Optional policies for Supabase
-- To allow public read access for questions and metrics, enable select.
-- For update/insert/delete, keep restricted to authenticated admin or service role.

-- Enable RLS on each table
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

-- Public read access for questions and metrics
CREATE POLICY "Public read questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Public read question metrics" ON public.question_metrics FOR SELECT USING (true);

-- Admin-only write access for questions and metrics
-- This assumes your admin JWT includes claim: role = 'admin'
CREATE POLICY "Admin all questions" ON public.questions FOR ALL USING (auth.role = 'authenticated' AND auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin all question metrics" ON public.question_metrics FOR ALL USING (auth.role = 'authenticated' AND auth.jwt() ->> 'role' = 'admin');

-- Progress rules: each user can manage only their own progress
CREATE POLICY "Users manage own progress" ON public.progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users manage own progress insert" ON public.progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own progress update" ON public.progress FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own progress delete" ON public.progress FOR DELETE USING (user_id = auth.uid());

-- Optional admin access to all progress rows
-- CREATE POLICY "Admin manage all progress" ON public.progress FOR ALL USING (auth.role = 'authenticated' AND auth.jwt() ->> 'role' = 'admin');

-- Notes:
-- 1) `auth.uid()` is the Supabase user ID from auth JWT.
-- 2) The `questions` and `question_metrics` tables are public read-only for learners.
-- 3) Only admin users (JWT claim role=admin) can create/update/delete questions and metrics.
-- 4) For admin UI with Supabase anon key, use a separate admin JWT or direct service key on server-side.
