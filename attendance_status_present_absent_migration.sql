-- One-time migration: reduce `public.attendance_status` to only
-- `present` and `absent`, and rewrite existing `class_attendance.status` values.
--
-- Mapping:
-- - present -> present
-- - late    -> present
-- - excused -> present
-- - absent  -> absent
--
-- Usage: run this after you have the updated schema/code deployed.
-- (If your database already had only present/absent, this will do nothing.)

begin;

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'attendance_status'
      and e.enumlabel in ('late', 'excused')
  ) then
    -- Create the new reduced enum type.
    if not exists (
      select 1 from pg_type where typname = 'attendance_status_new'
    ) then
      create type public.attendance_status_new as enum ('present', 'absent');
    end if;

    -- Normalize all existing rows into only present/absent (using old enum labels).
    update public.class_attendance
    set status =
      case
        when status::text in ('present', 'late', 'excused') then 'present'
        else 'absent'
      end::text::public.attendance_status_new;

    -- Switch the column to the new enum type.
    alter table public.class_attendance
      alter column status type public.attendance_status_new
      using status::text::public.attendance_status_new;

    -- Swap enum type names.
    drop type public.attendance_status;
    alter type public.attendance_status_new rename to attendance_status;
  end if;
end $$;

commit;

