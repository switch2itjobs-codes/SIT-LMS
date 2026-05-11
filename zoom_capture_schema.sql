-- =========================================================
-- Zoom Capture Schema — chat messages, polls, reports
-- For SIT LMS class sessions
-- Apply via Supabase SQL Editor
-- =========================================================

-- 1. In-meeting chat messages
--    Captured both live (webhook) and post-meeting (recording chat file)
CREATE TABLE IF NOT EXISTS public.class_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  zoom_meeting_id text,
  zoom_meeting_uuid text,
  sender_name text,
  sender_email text,
  sender_zoom_user_id text,
  message_text text NOT NULL,
  sent_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'webhook_live',  -- 'webhook_live' | 'recording_file'
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_chat_messages_source_check
    CHECK (source IN ('webhook_live', 'recording_file'))
);

CREATE INDEX IF NOT EXISTS idx_class_chat_messages_session
  ON public.class_chat_messages(class_session_id, sent_at);

-- 2. Polls (questions + responses)
--    Fetched from Zoom REST after meeting ends
CREATE TABLE IF NOT EXISTS public.class_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  zoom_meeting_id text,
  zoom_meeting_uuid text,
  zoom_poll_id text,
  poll_title text,
  status text,
  anonymous boolean DEFAULT false,
  poll_type integer,
  questions jsonb,
  responses jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_polls_unique UNIQUE (class_session_id, zoom_poll_id)
);

CREATE INDEX IF NOT EXISTS idx_class_polls_session
  ON public.class_polls(class_session_id);

-- 3. Engagement report (one row per meeting)
CREATE TABLE IF NOT EXISTS public.class_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id uuid NOT NULL UNIQUE REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  zoom_meeting_id text,
  zoom_meeting_uuid text,
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer,
  participants_count integer,
  unique_participants integer,
  raw jsonb,  -- full Zoom report response for forensics
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_reports_session
  ON public.class_reports(class_session_id);

-- =========================================================
-- Extend class_attendance with engagement fields
-- =========================================================
ALTER TABLE public.class_attendance
  ADD COLUMN IF NOT EXISTS join_time timestamptz,
  ADD COLUMN IF NOT EXISTS leave_time timestamptz,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS device text,
  ADD COLUMN IF NOT EXISTS attentiveness_score integer;

-- =========================================================
-- RLS: students/trainers can read their own batch's data,
--      admins/service role can read all.
-- =========================================================
ALTER TABLE public.class_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_reports ENABLE ROW LEVEL SECURITY;

-- Chat: anyone enrolled in the batch can read
DROP POLICY IF EXISTS class_chat_messages_select ON public.class_chat_messages;
CREATE POLICY class_chat_messages_select
ON public.class_chat_messages
FOR SELECT
TO authenticated
USING (
  public.current_app_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.class_sessions cs
    JOIN public.batches b ON b.id = cs.batch_id
    LEFT JOIN public.student_batches sb
      ON sb.batch_id = b.id AND sb.student_id = public.current_student_id()
    WHERE cs.id = class_chat_messages.class_session_id
      AND (
        sb.id IS NOT NULL
        OR b.trainer_id = public.current_trainer_id()
      )
  )
);

-- Polls: same rule
DROP POLICY IF EXISTS class_polls_select ON public.class_polls;
CREATE POLICY class_polls_select
ON public.class_polls
FOR SELECT
TO authenticated
USING (
  public.current_app_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.class_sessions cs
    JOIN public.batches b ON b.id = cs.batch_id
    LEFT JOIN public.student_batches sb
      ON sb.batch_id = b.id AND sb.student_id = public.current_student_id()
    WHERE cs.id = class_polls.class_session_id
      AND (
        sb.id IS NOT NULL
        OR b.trainer_id = public.current_trainer_id()
      )
  )
);

-- Reports: admin + trainer of the batch (students don't see aggregate reports)
DROP POLICY IF EXISTS class_reports_select ON public.class_reports;
CREATE POLICY class_reports_select
ON public.class_reports
FOR SELECT
TO authenticated
USING (
  public.current_app_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.class_sessions cs
    JOIN public.batches b ON b.id = cs.batch_id
    WHERE cs.id = class_reports.class_session_id
      AND b.trainer_id = public.current_trainer_id()
  )
);

-- Writes only via service role (backend webhooks). No explicit policy → blocked for authenticated.
