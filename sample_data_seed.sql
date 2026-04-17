-- Sample data seed for Student Management System
-- Prerequisite: run student_management_schema.sql first
-- Safe to re-run: uses ON CONFLICT upserts for core entities

begin;

-- =========================================================
-- Trainers
-- =========================================================
insert into public.trainers (trainer_name, email, phone, comments)
values
  ('Santosh', null, null, null),
  ('Madhav', null, null, null),
  ('Aslam', null, null, null),
  ('Sruthi', null, null, null),
  ('Satya', null, null, null),
  ('Anjani', null, null, null),
  ('Vipin', null, null, null),
  ('Vinod', null, null, null)
on conflict (trainer_name) do update
set
  email = excluded.email,
  phone = excluded.phone,
  comments = excluded.comments,
  updated_at = now();

-- =========================================================
-- Batches
-- =========================================================
insert into public.batches (
  batch_code, start_date, end_date, status, batch_capacity, trainer_id, notes, batch_type,
  batch_rating, total_revenue, collected_amount
)
values
  (
    'BAMAR25/26-ASLAM-MORNING',
    null,
    null,
    'completed',
    1,
    (select id from public.trainers where trainer_name = 'Aslam'),
    null,
    'morning',
    5.00,
    60000,
    0
  ),
  (
    'BAMAR30/26-SRUTHI-EVENING',
    null,
    null,
    'planned',
    4,
    (select id from public.trainers where trainer_name = 'Sruthi'),
    null,
    'evening',
    4.50,
    240000,
    90000
  ),
  (
    'BAMAR19/26-SANTOSH-EVENING',
    date '2026-03-19',
    date '2026-05-19',
    'active',
    3,
    (select id from public.trainers where trainer_name = 'Santosh'),
    null,
    'evening',
    3.33,
    180000,
    105000
  ),
  (
    'BAMAR19/26-MADHAV-MORNING',
    null,
    null,
    'active',
    3,
    (select id from public.trainers where trainer_name = 'Madhav'),
    null,
    'morning',
    4.67,
    180000,
    25000
  )
on conflict (batch_code) do update
set
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  status = excluded.status,
  batch_capacity = excluded.batch_capacity,
  trainer_id = excluded.trainer_id,
  notes = excluded.notes,
  batch_type = excluded.batch_type,
  batch_rating = excluded.batch_rating,
  total_revenue = excluded.total_revenue,
  collected_amount = excluded.collected_amount,
  updated_at = now();

-- =========================================================
-- Students
-- Note: sample emails are made unique intentionally.
-- =========================================================
insert into public.students (
  student_name, email, phone, gender, location, previous_job_role, experience_years, enrollment_date,
  stage, attendance_pct, progress_pct, trainer_rating, course_fee, amount_paid, payment_status,
  no_of_applications, no_of_interviews, offers_received, comments
)
values
  (
    'Harshitha',
    'harshitha@student.local',
    '+91-9010256581',
    'Female',
    'Hyderabad',
    'Sales',
    null,
    date '2026-03-04',
    'taking_interviews',
    58.00,
    74.00,
    5.00,
    60000,
    25000,
    'partial',
    0,
    0,
    0,
    null
  ),
  (
    'Habeeb Shaik',
    'habeeb.shaik@student.local',
    '+91-9581756765',
    'Male',
    'Hyderabad',
    'Marketing',
    null,
    date '2026-03-04',
    'training',
    null,
    23.00,
    5.00,
    60000,
    45000,
    'partial',
    1,
    0,
    0,
    null
  ),
  (
    'Votturi Bhargav',
    'votturi.bhargav@student.local',
    '+91-9700075785',
    'Male',
    'Hyderabad',
    'HR',
    null,
    date '2026-03-04',
    'training',
    null,
    34.00,
    4.00,
    60000,
    45000,
    'partial',
    0,
    0,
    0,
    null
  ),
  (
    'Aldrin Mathew',
    'aldrin.mathew@student.local',
    '+91-7736539866',
    'Male',
    'Hyderabad',
    'Operations',
    null,
    date '2026-03-04',
    'trial_classes',
    34.00,
    58.00,
    3.00,
    60000,
    45000,
    'partial',
    1,
    0,
    1,
    null
  ),
  (
    'Naga Kumari',
    'naga.kumari@student.local',
    '+91-9951850329',
    'Female',
    'Hyderabad',
    'Operations',
    null,
    date '2026-03-04',
    'mock_interviews',
    null,
    60.00,
    4.00,
    60000,
    60000,
    'paid',
    0,
    0,
    0,
    null
  ),
  (
    'Kalyani tarun kumar kumar',
    'kalyani.tarun@student.local',
    '+91-9398043798',
    'Male',
    'Hyderabad',
    'Developer',
    null,
    date '2026-03-04',
    'training',
    null,
    23.00,
    5.00,
    60000,
    0,
    'pending',
    0,
    0,
    0,
    null
  ),
  (
    'Vijay Kumar',
    'vijay.kumar@student.local',
    '+91-6303243912',
    'Male',
    'Hyderabad',
    'Healthcare',
    null,
    date '2026-03-04',
    'training',
    null,
    67.00,
    5.00,
    60000,
    0,
    'pending',
    0,
    0,
    0,
    null
  ),
  (
    'Minisha Munjeti',
    'minisha.munjeti@student.local',
    '+91-7989342494',
    'Female',
    'Hyderabad',
    'Teaching',
    null,
    date '2026-03-04',
    'searching_for_jobs',
    null,
    89.00,
    4.00,
    60000,
    0,
    'pending',
    0,
    0,
    0,
    null
  ),
  (
    'Prem',
    'prem@student.local',
    '+91-9966762421',
    'Male',
    'Bangalore',
    'Developer',
    null,
    date '2026-03-04',
    'training',
    null,
    34.00,
    5.00,
    60000,
    0,
    'pending',
    0,
    0,
    0,
    null
  ),
  (
    'Deepthi Rakesh',
    'deepthi.rakesh@student.local',
    '+91-7093143380',
    'Male',
    'Bangalore',
    'Healthcare',
    null,
    date '2026-03-04',
    'training',
    null,
    45.00,
    3.00,
    60000,
    0,
    'pending',
    0,
    0,
    0,
    null
  ),
  (
    'Esther Sebastian',
    'esther.sebastian@student.local',
    '+91-9502845874',
    'Male',
    'Hyderabad',
    'Operations',
    null,
    date '2026-03-04',
    'training',
    null,
    67.00,
    4.00,
    60000,
    0,
    'pending',
    0,
    0,
    0,
    null
  )
on conflict (email) do update
set
  student_name = excluded.student_name,
  phone = excluded.phone,
  gender = excluded.gender,
  location = excluded.location,
  previous_job_role = excluded.previous_job_role,
  experience_years = excluded.experience_years,
  enrollment_date = excluded.enrollment_date,
  stage = excluded.stage,
  attendance_pct = excluded.attendance_pct,
  progress_pct = excluded.progress_pct,
  trainer_rating = excluded.trainer_rating,
  course_fee = excluded.course_fee,
  amount_paid = excluded.amount_paid,
  payment_status = excluded.payment_status,
  no_of_applications = excluded.no_of_applications,
  no_of_interviews = excluded.no_of_interviews,
  offers_received = excluded.offers_received,
  comments = excluded.comments,
  updated_at = now();

-- =========================================================
-- Student-Batch relation
-- =========================================================
insert into public.student_batches (student_id, batch_id, joined_at, is_active)
values
  ((select id from public.students where email = 'vijay.kumar@student.local'), (select id from public.batches where batch_code = 'BAMAR25/26-ASLAM-MORNING'), date '2026-03-04', true),
  ((select id from public.students where email = 'habeeb.shaik@student.local'), (select id from public.batches where batch_code = 'BAMAR30/26-SRUTHI-EVENING'), date '2026-03-04', true),
  ((select id from public.students where email = 'kalyani.tarun@student.local'), (select id from public.batches where batch_code = 'BAMAR30/26-SRUTHI-EVENING'), date '2026-03-04', true),
  ((select id from public.students where email = 'minisha.munjeti@student.local'), (select id from public.batches where batch_code = 'BAMAR30/26-SRUTHI-EVENING'), date '2026-03-04', true),
  ((select id from public.students where email = 'votturi.bhargav@student.local'), (select id from public.batches where batch_code = 'BAMAR30/26-SRUTHI-EVENING'), date '2026-03-04', true),
  ((select id from public.students where email = 'aldrin.mathew@student.local'), (select id from public.batches where batch_code = 'BAMAR19/26-SANTOSH-EVENING'), date '2026-03-04', true),
  ((select id from public.students where email = 'naga.kumari@student.local'), (select id from public.batches where batch_code = 'BAMAR19/26-SANTOSH-EVENING'), date '2026-03-04', true),
  ((select id from public.students where email = 'deepthi.rakesh@student.local'), (select id from public.batches where batch_code = 'BAMAR19/26-SANTOSH-EVENING'), date '2026-03-04', true),
  ((select id from public.students where email = 'prem@student.local'), (select id from public.batches where batch_code = 'BAMAR19/26-MADHAV-MORNING'), date '2026-03-04', true),
  ((select id from public.students where email = 'esther.sebastian@student.local'), (select id from public.batches where batch_code = 'BAMAR19/26-MADHAV-MORNING'), date '2026-03-04', true),
  ((select id from public.students where email = 'harshitha@student.local'), (select id from public.batches where batch_code = 'BAMAR19/26-MADHAV-MORNING'), date '2026-03-04', true)
on conflict (student_id, batch_id) do update
set
  joined_at = excluded.joined_at,
  is_active = excluded.is_active,
  updated_at = now();

-- =========================================================
-- Progress activities
-- =========================================================
insert into public.progress_activities (
  id, student_id, trainer_id, activity_type, status, activity_date, notes, attachment_url, progress_score, completion_feedback
)
values
  (
    16,
    (select id from public.students where email = 'habeeb.shaik@student.local'),
    (select id from public.trainers where trainer_name = 'Sruthi'),
    'Resume Preparatiom',
    'completed',
    date '2026-04-04',
    null,
    null,
    null,
    null
  ),
  (
    17,
    (select id from public.students where email = 'aldrin.mathew@student.local'),
    (select id from public.trainers where trainer_name = 'Santosh'),
    'Mock Interview',
    'in_progress',
    date '2026-04-12',
    null,
    null,
    null,
    null
  ),
  (
    18,
    (select id from public.students where email = 'harshitha@student.local'),
    (select id from public.trainers where trainer_name = 'Madhav'),
    'Job Application',
    'completed',
    date '2026-04-13',
    null,
    null,
    null,
    null
  ),
  (
    23,
    (select id from public.students where email = 'aldrin.mathew@student.local'),
    (select id from public.trainers where trainer_name = 'Santosh'),
    'Training',
    'completed',
    date '2026-04-15',
    null,
    null,
    25,
    null
  ),
  (
    24,
    (select id from public.students where email = 'habeeb.shaik@student.local'),
    (select id from public.trainers where trainer_name = 'Sruthi'),
    'Mock Interview',
    'completed',
    date '2026-04-13',
    null,
    null,
    null,
    null
  ),
  (
    25,
    (select id from public.students where email = 'aldrin.mathew@student.local'),
    (select id from public.trainers where trainer_name = 'Santosh'),
    'Mock Interview',
    'completed',
    date '2026-04-14',
    null,
    null,
    null,
    null
  )
on conflict (id) do update
set
  student_id = excluded.student_id,
  trainer_id = excluded.trainer_id,
  activity_type = excluded.activity_type,
  status = excluded.status,
  activity_date = excluded.activity_date,
  notes = excluded.notes,
  attachment_url = excluded.attachment_url,
  progress_score = excluded.progress_score,
  completion_feedback = excluded.completion_feedback;

-- Keep sequence aligned after manual ids.
select setval(
  pg_get_serial_sequence('public.progress_activities', 'id'),
  coalesce((select max(id) from public.progress_activities), 1),
  true
);

-- =========================================================
-- Interviews
-- =========================================================
insert into public.interviews (student_id, company_name, role_title, stage, interview_date)
values
  (
    (select id from public.students where email = 'habeeb.shaik@student.local'),
    'IVY',
    'BA',
    'scheduled',
    date '2026-04-07'
  ),
  (
    (select id from public.students where email = 'aldrin.mathew@student.local'),
    'IVY',
    null,
    'selected',
    date '2026-04-15'
  );

-- =========================================================
-- Placements (multiple placements per student supported)
-- =========================================================
insert into public.placements (
  student_id, company_name, job_role, salary_package, placement_date, notes, offer_letter_url, hr_contact, company_website
)
values
  (
    (select id from public.students where email = 'harshitha@student.local'),
    'JP Morgan',
    'BA',
    15.00,
    date '2026-04-15',
    null,
    null,
    null,
    null
  ),
  (
    (select id from public.students where email = 'votturi.bhargav@student.local'),
    'Gemini',
    'Business Analyst',
    24.00,
    date '2026-04-13',
    null,
    null,
    null,
    null
  );

-- =========================================================
-- Payments
-- CSV payment row had missing amount/date, so no payment imported from it.
-- Add valid payment rows below when available.
-- =========================================================

commit;
