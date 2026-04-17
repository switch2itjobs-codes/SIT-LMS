-- Auth and profile setup for Student Management System
-- Prerequisite: student_management_schema.sql

begin;

create schema if not exists private;

-- =========================================================
-- Auto-create/update profile from auth.users
-- =========================================================
create or replace function private.resolve_app_role(app_meta jsonb)
returns public.app_role
language plpgsql
stable
as $$
declare
  role_text text;
begin
  role_text := coalesce(app_meta ->> 'role', 'student');

  if role_text not in ('admin', 'trainer', 'student') then
    role_text := 'student';
  end if;

  return role_text::public.app_role;
end;
$$;

create or replace function private.handle_auth_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    new.email,
    new.phone,
    private.resolve_app_role(new.raw_app_meta_data)
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;

create or replace function private.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  update public.profiles p
  set
    email = new.email,
    phone = new.phone,
    full_name = coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      p.full_name
    ),
    role = private.resolve_app_role(new.raw_app_meta_data),
    updated_at = now()
  where p.id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_insert_profile on auth.users;
create trigger trg_auth_user_insert_profile
after insert on auth.users
for each row
execute function private.handle_auth_user_insert();

drop trigger if exists trg_auth_user_update_profile on auth.users;
create trigger trg_auth_user_update_profile
after update of email, phone, raw_user_meta_data, raw_app_meta_data on auth.users
for each row
execute function private.handle_auth_user_update();

-- =========================================================
-- Backfill profiles for existing auth.users
-- =========================================================
insert into public.profiles (id, full_name, email, phone, role)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(coalesce(u.email, 'user'), '@', 1)
  ) as full_name,
  u.email,
  u.phone,
  private.resolve_app_role(u.raw_app_meta_data) as role
from auth.users u
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  phone = excluded.phone,
  role = excluded.role,
  updated_at = now();

-- =========================================================
-- Link domain records to auth users by email (when emails match)
-- =========================================================
update public.students s
set profile_id = u.id,
    updated_at = now()
from auth.users u
where lower(u.email) = lower(s.email)
  and (s.profile_id is null or s.profile_id <> u.id);

update public.trainers t
set profile_id = u.id,
    updated_at = now()
from auth.users u
where t.email is not null
  and lower(u.email) = lower(t.email)
  and (t.profile_id is null or t.profile_id <> u.id);

commit;

-- =========================================================
-- Optional admin bootstrap examples (run manually if needed)
-- =========================================================
-- update public.profiles
-- set role = 'admin', updated_at = now()
-- where email in ('founder@yourdomain.com');

-- update public.profiles
-- set role = 'trainer', updated_at = now()
-- where email in ('trainer1@yourdomain.com');
