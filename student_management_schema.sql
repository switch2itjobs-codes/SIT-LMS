-- Student Management System foundation schema for Supabase (Postgres)
-- Derived from CSVs:
--   Batches, Students, Trainers, Payments, Progress, Placements, Interviews
-- Plus app-ready tables for student login, live classes, announcements, attendance.

create extension if not exists pgcrypto;

-- =========================================================
-- Enums
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'trainer', 'student');
  end if;

  if not exists (select 1 from pg_type where typname = 'batch_status') then
    create type public.batch_status as enum ('planned', 'active', 'completed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'batch_type') then
    create type public.batch_type as enum ('morning', 'evening', 'weekend', 'custom');
  end if;

  if not exists (select 1 from pg_type where typname = 'student_stage') then
    create type public.student_stage as enum (
      'training',
      'trial_classes',
      'mock_interviews',
      'searching_for_jobs',
      'taking_interviews',
      'placed',
      'inactive'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'progress_status') then
    create type public.progress_status as enum ('not_started', 'in_progress', 'completed', 'blocked');
  end if;

  if not exists (select 1 from pg_type where typname = 'interview_stage') then
    create type public.interview_stage as enum (
      'scheduled',
      'shortlisted',
      'interviewing',
      'selected',
      'rejected',
      'on_hold',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'partial', 'paid', 'refunded');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_mode') then
    create type public.payment_mode as enum ('cash', 'card', 'upi', 'bank_transfer', 'other');
  end if;

  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');
  end if;
end $$;

-- =========================================================
-- Auth-linked profile
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique,
  phone text,
  role public.app_role not null default 'student',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Master entities
-- =========================================================
create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  trainer_name text not null,
  email text,
  phone text,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainers_name_unique unique (trainer_name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  student_name text not null,
  email text not null unique,
  phone text,
  gender text,
  location text,
  previous_job_role text,
  experience_years numeric(4,1),
  enrollment_date date,
  resume_url text,
  stage public.student_stage not null default 'training',
  comments text,
  attendance_pct numeric(5,2) check (attendance_pct between 0 and 100),
  progress_pct numeric(5,2) check (progress_pct between 0 and 100),
  trainer_rating numeric(3,2) check (trainer_rating between 0 and 5),
  course_fee numeric(12,2) not null default 0 check (course_fee >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  pending_amount numeric(12,2) generated always as (greatest(course_fee - amount_paid, 0)) stored,
  payment_status public.payment_status not null default 'pending',
  no_of_applications integer not null default 0 check (no_of_applications >= 0),
  no_of_interviews integer not null default 0 check (no_of_interviews >= 0),
  offers_received integer not null default 0 check (offers_received >= 0),
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_name_phone_unique unique (student_name, phone)
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique, -- ex: BAMAR19/26-SANTOSH-EVENING
  start_date date,
  end_date date,
  status public.batch_status not null default 'planned',
  batch_capacity integer not null default 0 check (batch_capacity >= 0),
  trainer_id uuid references public.trainers(id) on delete set null,
  notes text,
  batch_type public.batch_type not null default 'custom',
  batch_rating numeric(3,2) check (batch_rating between 0 and 5),
  total_revenue numeric(12,2) not null default 0 check (total_revenue >= 0),
  collected_amount numeric(12,2) not null default 0 check (collected_amount >= 0),
  pending_amount numeric(12,2) generated always as (greatest(total_revenue - collected_amount, 0)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_date_check check (start_date is null or end_date is null or start_date <= end_date)
);

-- Many-to-many between students and batches
create table if not exists public.student_batches (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  joined_at date,
  is_active boolean not null default true,
  left_at date,
  dropout_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_batches_unique unique (student_id, batch_id),
  constraint student_batches_date_check check (left_at is null or joined_at is null or joined_at <= left_at)
);

-- =========================================================
-- Operational entities
-- =========================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date,
  payment_mode public.payment_mode not null default 'other',
  notes text,
  external_ref text,
  created_at timestamptz not null default now()
);

create table if not exists public.progress_activities (
  id bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  activity_type text not null, -- ex: Training, Mock Interview
  status public.progress_status not null default 'not_started',
  activity_date date,
  notes text,
  attachment_url text,
  progress_score integer check (progress_score between 0 and 100),
  completion_feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  company_name text not null,
  role_title text,
  stage public.interview_stage not null default 'scheduled',
  interview_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  company_name text not null,
  job_role text,
  salary_package numeric(12,2),
  placement_date date not null,
  notes text,
  offer_letter_url text,
  hr_contact text,
  company_website text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- App-facing tables requested by you
-- =========================================================
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  provider text not null default 'zoom',
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  join_url text,
  zoom_start_url text,
  zoom_password text,
  zoom_meeting_id text unique,
  zoom_meeting_uuid text,
  zoom_host_user_id text,
  zoom_status text not null default 'scheduled',
  recording_status text not null default 'pending',
  has_recording boolean not null default false,
  last_zoom_sync_at timestamptz,
  recording_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_sessions_provider_check check (provider in ('zoom')),
  constraint class_sessions_zoom_status_check check (
    zoom_status in ('scheduled', 'started', 'ended', 'cancelled')
  ),
  constraint class_sessions_recording_status_check check (
    recording_status in ('pending', 'processing', 'available', 'not_available')
  ),
  constraint class_sessions_time_check check (ends_at is null or starts_at <= ends_at)
);

create table if not exists public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.attendance_status not null default 'present',
  marked_at timestamptz not null default now(),
  notes text,
  constraint class_attendance_unique unique (class_session_id, student_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete cascade, -- null = global
  posted_by_profile_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  is_important boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.trainer_zoom_hosts (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  zoom_user_id text,
  zoom_user_email text,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_zoom_hosts_identity_check check (
    zoom_user_id is not null or zoom_user_email is not null
  ),
  constraint trainer_zoom_hosts_unique unique (trainer_id, zoom_user_id, zoom_user_email)
);

create table if not exists public.class_session_recordings (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  zoom_recording_id text,
  zoom_file_id text not null,
  file_type text not null,
  recording_start timestamptz,
  recording_end timestamptz,
  play_url text,
  download_url text,
  file_size bigint,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_session_recordings_unique unique (class_session_id, zoom_file_id)
);

create table if not exists public.class_session_participants (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  zoom_user_id text,
  user_email text,
  user_name text,
  join_time timestamptz,
  leave_time timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  source text not null default 'zoom_webhook',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_session_participants_unique unique (class_session_id, user_email, join_time)
);

create table if not exists public.zoom_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_ts bigint,
  meeting_uuid text,
  payload_json jsonb not null,
  signature_valid boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint zoom_webhook_events_unique unique (event_name, event_ts, meeting_uuid)
);

-- =========================================================
-- Helpful indexes
-- =========================================================
create index if not exists idx_students_email on public.students(email);
create index if not exists idx_students_phone on public.students(phone);
create index if not exists idx_batches_trainer_id on public.batches(trainer_id);
create index if not exists idx_student_batches_student_id on public.student_batches(student_id);
create index if not exists idx_student_batches_batch_id on public.student_batches(batch_id);
create index if not exists idx_payments_student_id on public.payments(student_id);
create index if not exists idx_progress_student_id on public.progress_activities(student_id);
create index if not exists idx_interviews_student_id on public.interviews(student_id);
create index if not exists idx_placements_student_id on public.placements(student_id);
create index if not exists idx_class_sessions_batch_id on public.class_sessions(batch_id);
create index if not exists idx_announcements_batch_id on public.announcements(batch_id);
create index if not exists idx_class_sessions_zoom_meeting_id on public.class_sessions(zoom_meeting_id);
create index if not exists idx_class_session_recordings_session_id on public.class_session_recordings(class_session_id);
create index if not exists idx_class_session_participants_session_id on public.class_session_participants(class_session_id);
create index if not exists idx_class_session_participants_email on public.class_session_participants(user_email);
create index if not exists idx_zoom_webhook_events_meeting_uuid on public.zoom_webhook_events(meeting_uuid);

-- =========================================================
-- RLS baseline (must customize with your final role rules)
-- =========================================================
alter table public.profiles enable row level security;
alter table public.trainers enable row level security;
alter table public.students enable row level security;
alter table public.batches enable row level security;
alter table public.student_batches enable row level security;
alter table public.payments enable row level security;
alter table public.progress_activities enable row level security;
alter table public.interviews enable row level security;
alter table public.placements enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_attendance enable row level security;
alter table public.announcements enable row level security;
alter table public.trainer_zoom_hosts enable row level security;
alter table public.class_session_recordings enable row level security;
alter table public.class_session_participants enable row level security;
alter table public.zoom_webhook_events enable row level security;

-- NOTE:
-- 1) Policies are intentionally not added yet because we should confirm your final
--    access matrix (student/trainer/admin) before locking security behavior.
-- 2) After creating this schema, we can load CSV data and then add strict policies.
