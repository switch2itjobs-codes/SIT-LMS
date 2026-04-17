begin;

alter table public.class_sessions
  add column if not exists provider text not null default 'zoom',
  add column if not exists zoom_start_url text,
  add column if not exists zoom_password text,
  add column if not exists zoom_meeting_id text,
  add column if not exists zoom_meeting_uuid text,
  add column if not exists zoom_host_user_id text,
  add column if not exists zoom_status text not null default 'scheduled',
  add column if not exists recording_status text not null default 'pending',
  add column if not exists has_recording boolean not null default false,
  add column if not exists last_zoom_sync_at timestamptz;

alter table public.class_sessions
  drop constraint if exists class_sessions_provider_check,
  drop constraint if exists class_sessions_zoom_status_check,
  drop constraint if exists class_sessions_recording_status_check;

alter table public.class_sessions
  add constraint class_sessions_provider_check
  check (provider in ('zoom'));

alter table public.class_sessions
  add constraint class_sessions_zoom_status_check
  check (zoom_status in ('scheduled', 'started', 'ended', 'cancelled'));

alter table public.class_sessions
  add constraint class_sessions_recording_status_check
  check (recording_status in ('pending', 'processing', 'available', 'not_available'));

create unique index if not exists idx_class_sessions_zoom_meeting_id
on public.class_sessions(zoom_meeting_id)
where zoom_meeting_id is not null;

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

create index if not exists idx_class_session_recordings_session_id
on public.class_session_recordings(class_session_id);

create index if not exists idx_class_session_participants_session_id
on public.class_session_participants(class_session_id);

create index if not exists idx_class_session_participants_email
on public.class_session_participants(user_email);

create index if not exists idx_zoom_webhook_events_meeting_uuid
on public.zoom_webhook_events(meeting_uuid);

alter table public.trainer_zoom_hosts enable row level security;
alter table public.class_session_recordings enable row level security;
alter table public.class_session_participants enable row level security;
alter table public.zoom_webhook_events enable row level security;

commit;
