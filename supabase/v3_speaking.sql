-- V3: English speaking quiz + multi-file uploads. Run in the Supabase SQL editor after v2_quizzes.sql.
alter table public.homework add column file_paths text[] not null default '{}';
alter table public.submissions add column file_paths text[] not null default '{}';
update public.homework set file_paths = array[file_path] where file_path is not null;
update public.submissions set file_paths = array[file_path] where file_path is not null;

create table public.speaking_sets (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft','assigned')),
  created_at timestamptz not null default now()
);
create table public.speaking_tasks (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.speaking_sets on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('repeat','answer','describe')),
  prompt text not null,
  target text not null default '',
  hint text not null default ''
);
create index on public.speaking_tasks (set_id, position);
create table public.speaking_attempts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.speaking_tasks on delete cascade,
  audio_path text,
  transcript text not null default '',
  ai_score int check (ai_score between 0 and 5),
  ai_feedback text not null default '',
  teacher_score int check (teacher_score between 0 and 5),
  teacher_comment text not null default '',
  created_at timestamptz not null default now()
);
create index on public.speaking_attempts (task_id, created_at desc);

alter table public.speaking_sets enable row level security;
alter table public.speaking_tasks enable row level security;
alter table public.speaking_attempts enable row level security;

create policy "teacher speaking sets" on public.speaking_sets for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
create policy "others read assigned speaking sets" on public.speaking_sets for select
  using (status = 'assigned' and auth.uid() is not null);
create policy "teacher speaking tasks" on public.speaking_tasks for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
create policy "others read assigned speaking tasks" on public.speaking_tasks for select
  using (exists (select 1 from public.speaking_sets s where s.id = set_id and s.status = 'assigned') and auth.uid() is not null);
create policy "read speaking attempts" on public.speaking_attempts for select using (auth.uid() is not null);
create policy "student speaks" on public.speaking_attempts for insert with check (public.my_role() = 'student');
create policy "teacher grades speaking" on public.speaking_attempts for update
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
create policy "teacher deletes speaking attempts" on public.speaking_attempts for delete using (public.my_role() = 'teacher');
