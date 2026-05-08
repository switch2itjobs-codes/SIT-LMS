-- =========================================================
-- PRODUCTION MIGRATIONS — Run in Supabase SQL Editor
-- Consolidated from all migration files
-- =========================================================

-- 1. Avatar column on students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Allow students to see ALL batches (for enrollment tab)
DROP POLICY IF EXISTS batches_select_scope ON public.batches;
CREATE POLICY batches_select_scope
ON public.batches
FOR SELECT
TO authenticated
USING (
  public.current_app_role() = 'admin'
  OR trainer_id = public.current_trainer_id()
  OR public.current_app_role() = 'student'
);

-- 3. Allow students to enroll themselves into batches
DROP POLICY IF EXISTS student_batches_insert_scope ON public.student_batches;
CREATE POLICY student_batches_insert_scope
ON public.student_batches
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_app_role() = 'admin'
  OR EXISTS (
    SELECT 1
    FROM public.batches b
    WHERE b.id = student_batches.batch_id
      AND b.trainer_id = public.current_trainer_id()
  )
  OR (
    public.current_app_role() = 'student'
    AND student_id = public.current_student_id()
  )
);

-- 4. Allow students to create their own record during signup
DROP POLICY IF EXISTS students_insert_admin_only ON public.students;
DROP POLICY IF EXISTS students_insert_scope ON public.students;
CREATE POLICY students_insert_scope
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_app_role() = 'admin'
  OR profile_id = auth.uid()
);

-- 5. Degree CHECK constraint
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_degree_check;
ALTER TABLE public.students
ADD CONSTRAINT students_degree_check
CHECK (
  degree IS NULL
  OR degree IN (
    'MBA',
    'ME/ MTech',
    'BE/ BTech',
    'BBA',
    'BCom',
    'BSc',
    'master''s_degree',
    'diploma',
    'bachelor''s_degree',
    'other'
  )
);

-- 6. Domain CHECK constraint
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_domain_check;
ALTER TABLE public.students
ADD CONSTRAINT students_domain_check
CHECK (
  domain IS NULL
  OR domain IN (
    'Sales',
    'Operations',
    'Banking',
    'Finance',
    'BPO''s',
    'Healthcare',
    'Fresher',
    'Teacher',
    'Developer',
    'Testing',
    'HR Recruiters',
    'Digital Marketing',
    'Engineers',
    'Support'
  )
);

-- 7. Phone unique + format constraints
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_phone_unique;
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_phone_format;

ALTER TABLE public.students
ADD CONSTRAINT students_phone_unique UNIQUE (phone);

ALTER TABLE public.students
ADD CONSTRAINT students_phone_format
CHECK (
  phone IS NULL
  OR phone ~ '^\d{10}$'
  OR phone ~ '^\+91\d{10}$'
  OR phone ~ '^\+91-\d{10}$'
);
