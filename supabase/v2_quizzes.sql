-- V2: weekly auto quizzes. Teacher gives topics -> AI drafts -> teacher reviews -> assigns -> Kashika attempts.

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  topic text not null,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft','assigned')),
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes on delete cascade,
  position int not null default 0,
  type text not null check (type in ('mcq','fill','match')),
  prompt text not null,
  -- mcq: options = ["a","b","c","d"], answer = 2 (index)
  -- fill: options = [], answer = ["accepted 1","accepted 2"]
  -- match: options = {"left":[...],"right":[...shuffled]}, answer = [rightIndexForLeft0, ...]
  options jsonb not null default '[]'::jsonb,
  answer jsonb not null,
  explanation text not null default ''
);
create index on public.quiz_questions (quiz_id, position);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes on delete cascade,
  responses jsonb not null default '{}'::jsonb,
  score int not null,
  total int not null,
  submitted_at timestamptz not null default now()
);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "teacher quizzes" on public.quizzes for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
create policy "others read assigned quizzes" on public.quizzes for select
  using (status = 'assigned' and auth.uid() is not null);

create policy "teacher questions" on public.quiz_questions for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
create policy "others read assigned questions" on public.quiz_questions for select
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.status = 'assigned') and auth.uid() is not null);

create policy "read attempts" on public.quiz_attempts for select using (auth.uid() is not null);
create policy "student attempts" on public.quiz_attempts for insert with check (public.my_role() = 'student');
create policy "teacher deletes attempts" on public.quiz_attempts for delete using (public.my_role() = 'teacher');
