-- RLS policies for Student Management System
-- Roles: admin, trainer, student
-- Prerequisite: student_management_schema.sql

begin;

-- =========================================================
-- Helper functions used by policies
-- =========================================================
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select
    case
      when (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'trainer', 'student')
        then (auth.jwt() -> 'app_metadata' ->> 'role')::public.app_role
      else 'student'::public.app_role
    end
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
as $$
  select s.id
  from public.students s
  where s.profile_id = auth.uid()
$$;

create or replace function public.current_trainer_id()
returns uuid
language sql
stable
as $$
  select t.id
  from public.trainers t
  where t.profile_id = auth.uid()
$$;

-- =========================================================
-- profiles
-- =========================================================
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_app_role() = 'admin'
);

drop policy if exists profiles_insert_self_or_admin on public.profiles;
create policy profiles_insert_self_or_admin
on public.profiles
for insert
to authenticated
with check (
  (id = auth.uid() and role = public.current_app_role())
  or public.current_app_role() = 'admin'
);

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.current_app_role() = 'admin'
)
with check (
  (id = auth.uid() and role = public.current_app_role())
  or public.current_app_role() = 'admin'
);

drop policy if exists profiles_delete_admin_only on public.profiles;
create policy profiles_delete_admin_only
on public.profiles
for delete
to authenticated
using (public.current_app_role() = 'admin');

-- =========================================================
-- trainers
-- =========================================================
drop policy if exists trainers_select_scope on public.trainers;
create policy trainers_select_scope
on public.trainers
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = public.current_student_id()
      and b.trainer_id = trainers.id
  )
);

drop policy if exists trainers_insert_admin_only on public.trainers;
create policy trainers_insert_admin_only
on public.trainers
for insert
to authenticated
with check (public.current_app_role() = 'admin');

drop policy if exists trainers_update_own_or_admin on public.trainers;
create policy trainers_update_own_or_admin
on public.trainers
for update
to authenticated
using (
  public.current_app_role() = 'admin'
  or profile_id = auth.uid()
)
with check (
  public.current_app_role() = 'admin'
  or profile_id = auth.uid()
);

drop policy if exists trainers_delete_admin_only on public.trainers;
create policy trainers_delete_admin_only
on public.trainers
for delete
to authenticated
using (public.current_app_role() = 'admin');

-- =========================================================
-- students
-- =========================================================
drop policy if exists students_select_scope on public.students;
create policy students_select_scope
on public.students
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = students.id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists students_insert_admin_only on public.students;
create policy students_insert_admin_only
on public.students
for insert
to authenticated
with check (public.current_app_role() = 'admin');

drop policy if exists students_update_scope on public.students;
create policy students_update_scope
on public.students
for update
to authenticated
using (
  public.current_app_role() = 'admin'
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = students.id
      and b.trainer_id = public.current_trainer_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = students.id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists students_delete_admin_only on public.students;
create policy students_delete_admin_only
on public.students
for delete
to authenticated
using (public.current_app_role() = 'admin');

-- =========================================================
-- batches
-- =========================================================
drop policy if exists batches_select_scope on public.batches;
create policy batches_select_scope
on public.batches
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or trainer_id = public.current_trainer_id()
  or exists (
    select 1
    from public.student_batches sb
    where sb.batch_id = batches.id
      and sb.student_id = public.current_student_id()
  )
);

drop policy if exists batches_insert_admin_only on public.batches;
create policy batches_insert_admin_only
on public.batches
for insert
to authenticated
with check (public.current_app_role() = 'admin');

drop policy if exists batches_update_scope on public.batches;
create policy batches_update_scope
on public.batches
for update
to authenticated
using (
  public.current_app_role() = 'admin'
  or trainer_id = public.current_trainer_id()
)
with check (
  public.current_app_role() = 'admin'
  or trainer_id = public.current_trainer_id()
);

drop policy if exists batches_delete_admin_only on public.batches;
create policy batches_delete_admin_only
on public.batches
for delete
to authenticated
using (public.current_app_role() = 'admin');

-- =========================================================
-- student_batches
-- =========================================================
drop policy if exists student_batches_select_scope on public.student_batches;
create policy student_batches_select_scope
on public.student_batches
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.batches b
    where b.id = student_batches.batch_id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists student_batches_insert_scope on public.student_batches;
create policy student_batches_insert_scope
on public.student_batches
for insert
to authenticated
with check (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.batches b
    where b.id = student_batches.batch_id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists student_batches_update_scope on public.student_batches;
create policy student_batches_update_scope
on public.student_batches
for update
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.batches b
    where b.id = student_batches.batch_id
      and b.trainer_id = public.current_trainer_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.batches b
    where b.id = student_batches.batch_id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists student_batches_delete_scope on public.student_batches;
create policy student_batches_delete_scope
on public.student_batches
for delete
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.batches b
    where b.id = student_batches.batch_id
      and b.trainer_id = public.current_trainer_id()
  )
);

-- =========================================================
-- payments
-- =========================================================
drop policy if exists payments_select_scope on public.payments;
create policy payments_select_scope
on public.payments
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = payments.student_id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists payments_mutation_admin_only on public.payments;
create policy payments_mutation_admin_only
on public.payments
for all
to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

-- =========================================================
-- progress_activities
-- =========================================================
drop policy if exists progress_select_scope on public.progress_activities;
create policy progress_select_scope
on public.progress_activities
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or student_id = public.current_student_id()
  or trainer_id = public.current_trainer_id()
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = progress_activities.student_id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists progress_insert_scope on public.progress_activities;
create policy progress_insert_scope
on public.progress_activities
for insert
to authenticated
with check (
  public.current_app_role() = 'admin'
  or (
    public.current_app_role() = 'trainer'
    and exists (
      select 1
      from public.student_batches sb
      join public.batches b on b.id = sb.batch_id
      where sb.student_id = progress_activities.student_id
        and b.trainer_id = public.current_trainer_id()
    )
  )
);

drop policy if exists progress_update_scope on public.progress_activities;
create policy progress_update_scope
on public.progress_activities
for update
to authenticated
using (
  public.current_app_role() = 'admin'
  or (
    public.current_app_role() = 'trainer'
    and exists (
      select 1
      from public.student_batches sb
      join public.batches b on b.id = sb.batch_id
      where sb.student_id = progress_activities.student_id
        and b.trainer_id = public.current_trainer_id()
    )
  )
)
with check (
  public.current_app_role() = 'admin'
  or (
    public.current_app_role() = 'trainer'
    and exists (
      select 1
      from public.student_batches sb
      join public.batches b on b.id = sb.batch_id
      where sb.student_id = progress_activities.student_id
        and b.trainer_id = public.current_trainer_id()
    )
  )
);

drop policy if exists progress_delete_scope on public.progress_activities;
create policy progress_delete_scope
on public.progress_activities
for delete
to authenticated
using (
  public.current_app_role() = 'admin'
  or (
    public.current_app_role() = 'trainer'
    and exists (
      select 1
      from public.student_batches sb
      join public.batches b on b.id = sb.batch_id
      where sb.student_id = progress_activities.student_id
        and b.trainer_id = public.current_trainer_id()
    )
  )
);

-- =========================================================
-- interviews
-- =========================================================
drop policy if exists interviews_select_scope on public.interviews;
create policy interviews_select_scope
on public.interviews
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = interviews.student_id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists interviews_mutation_scope on public.interviews;
create policy interviews_mutation_scope
on public.interviews
for all
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = interviews.student_id
      and b.trainer_id = public.current_trainer_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = interviews.student_id
      and b.trainer_id = public.current_trainer_id()
  )
);

-- =========================================================
-- placements
-- =========================================================
drop policy if exists placements_select_scope on public.placements;
create policy placements_select_scope
on public.placements
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = placements.student_id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists placements_mutation_scope on public.placements;
create policy placements_mutation_scope
on public.placements
for all
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = placements.student_id
      and b.trainer_id = public.current_trainer_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = placements.student_id
      and b.trainer_id = public.current_trainer_id()
  )
);

-- =========================================================
-- mock_interviews
-- =========================================================
drop policy if exists mock_interviews_select_scope on public.mock_interviews;
create policy mock_interviews_select_scope
on public.mock_interviews
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = mock_interviews.student_id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists mock_interviews_mutation_scope on public.mock_interviews;
create policy mock_interviews_mutation_scope
on public.mock_interviews
for all
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = mock_interviews.student_id
      and b.trainer_id = public.current_trainer_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.student_batches sb
    join public.batches b on b.id = sb.batch_id
    where sb.student_id = mock_interviews.student_id
      and b.trainer_id = public.current_trainer_id()
  )
);

-- =========================================================
-- class_sessions
-- =========================================================
drop policy if exists class_sessions_select_scope on public.class_sessions;
create policy class_sessions_select_scope
on public.class_sessions
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or trainer_id = public.current_trainer_id()
  or exists (
    select 1
    from public.batches b
    where b.id = class_sessions.batch_id
      and b.trainer_id = public.current_trainer_id()
  )
  or exists (
    select 1
    from public.student_batches sb
    where sb.batch_id = class_sessions.batch_id
      and sb.student_id = public.current_student_id()
  )
);

drop policy if exists class_sessions_mutation_scope on public.class_sessions;
create policy class_sessions_mutation_scope
on public.class_sessions
for all
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.batches b
    where b.id = class_sessions.batch_id
      and b.trainer_id = public.current_trainer_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.batches b
    where b.id = class_sessions.batch_id
      and b.trainer_id = public.current_trainer_id()
  )
);

-- =========================================================
-- class_attendance
-- =========================================================
drop policy if exists class_attendance_select_scope on public.class_attendance;
create policy class_attendance_select_scope
on public.class_attendance
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.class_sessions cs
    join public.batches b on b.id = cs.batch_id
    where cs.id = class_attendance.class_session_id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists class_attendance_mutation_scope on public.class_attendance;
create policy class_attendance_mutation_scope
on public.class_attendance
for all
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.class_sessions cs
    join public.batches b on b.id = cs.batch_id
    where cs.id = class_attendance.class_session_id
      and b.trainer_id = public.current_trainer_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.class_sessions cs
    join public.batches b on b.id = cs.batch_id
    where cs.id = class_attendance.class_session_id
      and b.trainer_id = public.current_trainer_id()
  )
);

-- =========================================================
-- announcements
-- =========================================================
drop policy if exists announcements_select_scope on public.announcements;
create policy announcements_select_scope
on public.announcements
for select
to authenticated
using (
  batch_id is null
  or public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.batches b
    where b.id = announcements.batch_id
      and b.trainer_id = public.current_trainer_id()
  )
  or exists (
    select 1
    from public.student_batches sb
    where sb.batch_id = announcements.batch_id
      and sb.student_id = public.current_student_id()
  )
);

drop policy if exists announcements_mutation_scope on public.announcements;
create policy announcements_mutation_scope
on public.announcements
for all
to authenticated
using (
  public.current_app_role() = 'admin'
  or (
    batch_id is not null
    and exists (
      select 1
      from public.batches b
      where b.id = announcements.batch_id
        and b.trainer_id = public.current_trainer_id()
    )
  )
)
with check (
  public.current_app_role() = 'admin'
  or (
    batch_id is not null
    and exists (
      select 1
      from public.batches b
      where b.id = announcements.batch_id
        and b.trainer_id = public.current_trainer_id()
    )
  )
);

-- =========================================================
-- trainer_zoom_hosts
-- =========================================================
drop policy if exists trainer_zoom_hosts_select_scope on public.trainer_zoom_hosts;
create policy trainer_zoom_hosts_select_scope
on public.trainer_zoom_hosts
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or trainer_id = public.current_trainer_id()
);

drop policy if exists trainer_zoom_hosts_mutation_scope on public.trainer_zoom_hosts;
create policy trainer_zoom_hosts_mutation_scope
on public.trainer_zoom_hosts
for all
to authenticated
using (
  public.current_app_role() = 'admin'
  or trainer_id = public.current_trainer_id()
)
with check (
  public.current_app_role() = 'admin'
  or trainer_id = public.current_trainer_id()
);

-- =========================================================
-- class_session_recordings
-- =========================================================
drop policy if exists class_session_recordings_select_scope on public.class_session_recordings;
create policy class_session_recordings_select_scope
on public.class_session_recordings
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.class_sessions cs
    join public.batches b on b.id = cs.batch_id
    where cs.id = class_session_recordings.class_session_id
      and b.trainer_id = public.current_trainer_id()
  )
  or exists (
    select 1
    from public.class_sessions cs
    join public.student_batches sb on sb.batch_id = cs.batch_id
    where cs.id = class_session_recordings.class_session_id
      and sb.student_id = public.current_student_id()
  )
);

drop policy if exists class_session_recordings_mutation_scope on public.class_session_recordings;
create policy class_session_recordings_mutation_scope
on public.class_session_recordings
for all
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.class_sessions cs
    join public.batches b on b.id = cs.batch_id
    where cs.id = class_session_recordings.class_session_id
      and b.trainer_id = public.current_trainer_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.class_sessions cs
    join public.batches b on b.id = cs.batch_id
    where cs.id = class_session_recordings.class_session_id
      and b.trainer_id = public.current_trainer_id()
  )
);

-- =========================================================
-- class_session_participants
-- =========================================================
drop policy if exists class_session_participants_select_scope on public.class_session_participants;
create policy class_session_participants_select_scope
on public.class_session_participants
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.class_sessions cs
    join public.batches b on b.id = cs.batch_id
    where cs.id = class_session_participants.class_session_id
      and b.trainer_id = public.current_trainer_id()
  )
  or (
    user_email is not null
    and exists (
      select 1
      from public.students s
      where s.email = class_session_participants.user_email
        and s.id = public.current_student_id()
    )
  )
);

drop policy if exists class_session_participants_mutation_scope on public.class_session_participants;
create policy class_session_participants_mutation_scope
on public.class_session_participants
for all
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.class_sessions cs
    join public.batches b on b.id = cs.batch_id
    where cs.id = class_session_participants.class_session_id
      and b.trainer_id = public.current_trainer_id()
  )
)
with check (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.class_sessions cs
    join public.batches b on b.id = cs.batch_id
    where cs.id = class_session_participants.class_session_id
      and b.trainer_id = public.current_trainer_id()
  )
);

-- =========================================================
-- batch_community_messages
-- =========================================================
drop policy if exists batch_community_messages_select_scope on public.batch_community_messages;
create policy batch_community_messages_select_scope
on public.batch_community_messages
for select
to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1
    from public.student_batches sb
    where sb.batch_id = batch_community_messages.batch_id
      and sb.student_id = public.current_student_id()
  )
  or exists (
    select 1
    from public.batches b
    where b.id = batch_community_messages.batch_id
      and b.trainer_id = public.current_trainer_id()
  )
);

drop policy if exists batch_community_messages_insert_scope on public.batch_community_messages;
create policy batch_community_messages_insert_scope
on public.batch_community_messages
for insert
to authenticated
with check (
  public.current_app_role() = 'admin'
  or (
    sender_role = public.current_app_role()
    and (
      (public.current_app_role() = 'student'
        and exists (
          select 1
          from public.student_batches sb
          where sb.batch_id = batch_community_messages.batch_id
            and sb.student_id = public.current_student_id()
        )
      )
      or
      (public.current_app_role() = 'trainer'
        and exists (
          select 1
          from public.batches b
          where b.id = batch_community_messages.batch_id
            and b.trainer_id = public.current_trainer_id()
        )
      )
    )
  )
);

drop policy if exists batch_community_messages_update_admin_only on public.batch_community_messages;
create policy batch_community_messages_update_admin_only
on public.batch_community_messages
for update
to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists batch_community_messages_delete_admin_only on public.batch_community_messages;
create policy batch_community_messages_delete_admin_only
on public.batch_community_messages
for delete
to authenticated
using (public.current_app_role() = 'admin');

-- =========================================================
-- zoom_webhook_events
-- =========================================================
drop policy if exists zoom_webhook_events_select_admin_only on public.zoom_webhook_events;
create policy zoom_webhook_events_select_admin_only
on public.zoom_webhook_events
for select
to authenticated
using (public.current_app_role() = 'admin');

drop policy if exists zoom_webhook_events_mutation_admin_only on public.zoom_webhook_events;
create policy zoom_webhook_events_mutation_admin_only
on public.zoom_webhook_events
for all
to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

-- =========================================================
-- Grants (RLS still controls row access)
-- =========================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;
