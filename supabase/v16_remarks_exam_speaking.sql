-- V16: remarks with photos, test remarks, speaking transcript edit/typed flags, exam-mode events.
alter table public.submissions add column comment_files text[] not null default '{}';
alter table public.tests add column remarks text not null default '';
alter table public.speaking_attempts add column transcript_original text not null default '';
alter table public.speaking_attempts add column typed boolean not null default false;
create table public.exam_events (
  id uuid primary key default gen_random_uuid(),
  ref_kind text not null check (ref_kind in ('quiz','test')),
  ref_id uuid not null,
  event text not null,
  created_at timestamptz not null default now()
);
create index on public.exam_events (ref_kind, ref_id);
alter table public.exam_events enable row level security;
create policy "read exam events" on public.exam_events for select using (auth.uid() is not null);
create policy "student logs exam events" on public.exam_events for insert with check (public.my_role() = 'student');
create policy "teacher deletes exam events" on public.exam_events for delete using (public.my_role() = 'teacher');
