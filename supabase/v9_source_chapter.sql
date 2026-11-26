-- V9: remember which book chapter an AI-made set came from (so "Replace" stays on the same chapter).
alter table public.quizzes add column chapter_id uuid references public.book_chapters on delete set null;
alter table public.flashcard_sets add column chapter_id uuid references public.book_chapters on delete set null;
alter table public.speaking_sets add column chapter_id uuid references public.book_chapters on delete set null;
