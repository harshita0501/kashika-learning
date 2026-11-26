-- V12: syllabus photos; test paper visible only from the test date; Kashika's answer sheet.
alter table public.tests add column syllabus_files text[] not null default '{}';
create table public.test_papers (
  test_id uuid primary key references public.tests on delete cascade,
  file_paths text[] not null default '{}',
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.test_papers enable row level security;
create policy "teacher test papers" on public.test_papers for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
create policy "read paper on test day" on public.test_papers for select
  using (auth.uid() is not null and exists (
    select 1 from public.tests t where t.id = test_id and t.test_date <= (now() at time zone 'Asia/Kolkata')::date));
create table public.test_submissions (
  test_id uuid primary key references public.tests on delete cascade,
  file_paths text[] not null default '{}',
  note text not null default '',
  submitted_at timestamptz not null default now()
);
alter table public.test_submissions enable row level security;
create policy "read test submissions" on public.test_submissions for select using (auth.uid() is not null);
create policy "student submits test" on public.test_submissions for insert
  with check (public.my_role() = 'student' and exists (
    select 1 from public.tests t where t.id = test_id and t.test_date <= (now() at time zone 'Asia/Kolkata')::date));
create policy "student edits test answer" on public.test_submissions for update
  using (public.my_role() = 'student' and exists (select 1 from public.tests t where t.id = test_id and t.marks_obtained is null))
  with check (public.my_role() = 'student');
create policy "student deletes test answer" on public.test_submissions for delete
  using (public.my_role() = 'student' and exists (select 1 from public.tests t where t.id = test_id and t.marks_obtained is null));
create policy "teacher test submissions" on public.test_submissions for delete using (public.my_role() = 'teacher');
