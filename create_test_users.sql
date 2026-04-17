-- Test user bootstrap for Student Management System
--
-- IMPORTANT:
-- 1) First create these users in Supabase Auth (Dashboard -> Authentication -> Users):
--    - admin@institute.local
--    - santosh@institute.local
--    - harshitha@student.local
--    (use any password you prefer for all test users)
--
-- 2) Then run this SQL to:
--    - set app roles in auth metadata
--    - sync profile roles
--    - link trainer/student records to auth profiles
--
-- Prerequisites:
-- - student_management_schema.sql
-- - sample_data_seed.sql
-- - auth_profile_setup.sql
-- - rls_policies.sql

begin;

-- =========================================================
-- Optional: attach email to trainer rows so mapping works
-- =========================================================
update public.trainers
set email = 'santosh@institute.local',
    updated_at = now()
where trainer_name = 'Santosh'
  and (email is distinct from 'santosh@institute.local');

-- =========================================================
-- Set roles in auth.users app metadata
-- =========================================================
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'admin@institute.local';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"trainer"}'::jsonb
where email = 'santosh@institute.local';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"student"}'::jsonb
where email = 'harshitha@student.local';

-- =========================================================
-- Sync profile role from app metadata
-- (trigger may already do this; this is an explicit sync)
-- =========================================================
update public.profiles p
set role = case
             when (u.raw_app_meta_data ->> 'role') in ('admin', 'trainer', 'student')
               then (u.raw_app_meta_data ->> 'role')::public.app_role
             else 'student'::public.app_role
           end,
    updated_at = now()
from auth.users u
where u.id = p.id
  and u.email in ('admin@institute.local', 'santosh@institute.local', 'harshitha@student.local');

-- =========================================================
-- Link domain records to auth profiles
-- =========================================================
update public.students s
set profile_id = u.id,
    updated_at = now()
from auth.users u
where lower(s.email) = lower(u.email)
  and lower(u.email) = 'harshitha@student.local';

update public.trainers t
set profile_id = u.id,
    updated_at = now()
from auth.users u
where lower(t.email) = lower(u.email)
  and lower(u.email) = 'santosh@institute.local';

commit;

-- =========================================================
-- Verification queries
-- =========================================================
-- 1) Check auth users + metadata
select email, raw_app_meta_data
from auth.users
where email in ('admin@institute.local', 'santosh@institute.local', 'harshitha@student.local')
order by email;

-- 2) Check profile roles
select email, role
from public.profiles
where email in ('admin@institute.local', 'santosh@institute.local', 'harshitha@student.local')
order by email;

-- 3) Check student linkage
select s.student_name, s.email, s.profile_id is not null as linked_to_auth
from public.students s
where s.email = 'harshitha@student.local';

-- 4) Check trainer linkage
select t.trainer_name, t.email, t.profile_id is not null as linked_to_auth
from public.trainers t
where t.email = 'santosh@institute.local';

-- NOTE:
-- After role changes, users should sign out/sign in again
-- so JWT app_metadata.role gets refreshed for RLS checks.
