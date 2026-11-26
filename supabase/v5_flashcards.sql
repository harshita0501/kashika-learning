-- V5: weekly vocabulary flashcards. Run in the Supabase SQL editor.
create table public.flashcard_sets (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft','assigned')),
  created_at timestamptz not null default now()
);
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.flashcard_sets on delete cascade,
  position int not null default 0,
  word text not null,
  emoji text not null default '',
  meaning text not null,
  example text not null default '',
  hindi text not null default ''
);
create index on public.flashcards (set_id, position);
create table public.flashcard_progress (
  card_id uuid primary key references public.flashcards on delete cascade,
  known boolean not null default false,
  seen_count int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.flashcard_sets enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_progress enable row level security;
create policy "teacher flashcard sets" on public.flashcard_sets for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
create policy "others read assigned flashcard sets" on public.flashcard_sets for select
  using (status = 'assigned' and auth.uid() is not null);
create policy "teacher flashcards" on public.flashcards for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
create policy "others read assigned flashcards" on public.flashcards for select
  using (exists (select 1 from public.flashcard_sets s where s.id = set_id and s.status = 'assigned') and auth.uid() is not null);
create policy "read flashcard progress" on public.flashcard_progress for select using (auth.uid() is not null);
create policy "student saves progress" on public.flashcard_progress for insert with check (public.my_role() = 'student');
create policy "student updates progress" on public.flashcard_progress for update
  using (public.my_role() = 'student') with check (public.my_role() = 'student');
