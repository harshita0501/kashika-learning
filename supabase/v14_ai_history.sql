-- V14: remember what the AI already made per topic so repeating a topic gives a fresh set.
create table public.ai_history (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quiz','flashcards','speaking')),
  subject text not null default '',
  topic_key text not null,
  item text not null,
  created_at timestamptz not null default now()
);
create index on public.ai_history (kind, subject, topic_key, created_at desc);
alter table public.ai_history enable row level security;
create policy "teacher ai history" on public.ai_history for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
