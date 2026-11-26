-- V10: photos/PDFs ma'am uploads directly as the source for an AI-made quiz / flashcards / speaking set.
alter table public.quizzes add column source_paths text[] not null default '{}';
alter table public.flashcard_sets add column source_paths text[] not null default '{}';
alter table public.speaking_sets add column source_paths text[] not null default '{}';
