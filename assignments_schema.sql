create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  class_session_id uuid references public.class_sessions(id) on delete set null,
  title text not null,
  description text,
  attachment_url text,
  due_at timestamptz not null,
  max_marks integer check (max_marks is null or max_marks >= 0),
  submission_type text not null default 'both'
    check (submission_type in ('file_upload', 'text_answer', 'both')),
  assign_to_all boolean not null default true,
  target_student_ids uuid[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_assignments_batch_id on public.assignments(batch_id);
create index if not exists idx_assignments_class_session_id on public.assignments(class_session_id);
create index if not exists idx_assignments_due_at on public.assignments(due_at);

alter table public.assignments enable row level security;

drop policy if exists "assignments_authenticated_select" on public.assignments;
create policy "assignments_authenticated_select"
  on public.assignments
  for select
  to authenticated
  using (true);

drop policy if exists "assignments_authenticated_insert" on public.assignments;
create policy "assignments_authenticated_insert"
  on public.assignments
  for insert
  to authenticated
  with check (true);

drop policy if exists "assignments_authenticated_update" on public.assignments;
create policy "assignments_authenticated_update"
  on public.assignments
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "assignments_authenticated_delete" on public.assignments;
create policy "assignments_authenticated_delete"
  on public.assignments
  for delete
  to authenticated
  using (true);
