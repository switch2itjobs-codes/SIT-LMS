begin;

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

commit;
