-- V8: Books library (NCERT Class 3 + ma'am's own uploads). Run in the Supabase SQL editor.
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  class_level int not null default 3,
  publisher text not null default '',
  description text not null default '',
  emoji text not null default '📖',
  kind text not null default 'custom' check (kind in ('ncert','custom')),
  source_note text not null default '',
  created_at timestamptz not null default now()
);
create table public.book_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books on delete cascade,
  position int not null default 0,
  title text not null,
  file_paths text[] not null default '{}',
  pages int,
  created_at timestamptz not null default now()
);
create index on public.book_chapters (book_id, position);
alter table public.books enable row level security;
alter table public.book_chapters enable row level security;
create policy "read books" on public.books for select using (auth.uid() is not null);
create policy "teacher books" on public.books for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
create policy "read chapters" on public.book_chapters for select using (auth.uid() is not null);
create policy "teacher chapters" on public.book_chapters for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');
create policy "teacher deletes uploads" on storage.objects for delete
  using (bucket_id = 'uploads' and public.my_role() = 'teacher');
