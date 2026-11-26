-- V13: test start time (India time); paper opens at test_date + test_time; paper_ready lets Kashika see "uploaded" before it opens.
alter table public.tests add column test_time time;
alter table public.tests add column paper_ready boolean not null default false;
update public.tests set paper_ready = exists (select 1 from public.test_papers p where p.test_id = tests.id);
drop policy "read paper on test day" on public.test_papers;
create policy "read paper from test time" on public.test_papers for select
  using (auth.uid() is not null and exists (
    select 1 from public.tests t where t.id = test_id
      and (t.test_date + coalesce(t.test_time, time '00:00')) <= (now() at time zone 'Asia/Kolkata')));
drop policy "student submits test" on public.test_submissions;
create policy "student submits test" on public.test_submissions for insert
  with check (public.my_role() = 'student' and exists (
    select 1 from public.tests t where t.id = test_id
      and (t.test_date + coalesce(t.test_time, time '00:00')) <= (now() at time zone 'Asia/Kolkata')));
