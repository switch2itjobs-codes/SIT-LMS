-- Student profile fields for admin edit + personal tab (degree, company, domain, profile URLs)
-- Run against your Supabase project after baseline schema.
-- Creates `student-resumes` storage bucket for resume uploads from the admin UI.

begin;

alter table public.students
  add column if not exists degree text,
  add column if not exists previous_company text,
  add column if not exists domain text,
  add column if not exists linkedin_url text,
  add column if not exists naukri_url text,
  add column if not exists portfolio_url text;

insert into storage.buckets (id, name, public)
values ('student-resumes', 'student-resumes', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

drop policy if exists student_resumes_objects_select_public on storage.objects;
create policy student_resumes_objects_select_public
on storage.objects
for select
to public
using (bucket_id = 'student-resumes');

drop policy if exists student_resumes_objects_insert_authenticated on storage.objects;
create policy student_resumes_objects_insert_authenticated
on storage.objects
for insert
to authenticated
with check (bucket_id = 'student-resumes');

drop policy if exists student_resumes_objects_update_authenticated on storage.objects;
create policy student_resumes_objects_update_authenticated
on storage.objects
for update
to authenticated
using (bucket_id = 'student-resumes')
with check (bucket_id = 'student-resumes');

drop policy if exists student_resumes_objects_delete_authenticated on storage.objects;
create policy student_resumes_objects_delete_authenticated
on storage.objects
for delete
to authenticated
using (bucket_id = 'student-resumes');

commit;
