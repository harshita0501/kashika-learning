-- V11: grammar mistakes list on speaking attempts
alter table public.speaking_attempts add column mistakes jsonb not null default '[]'::jsonb;
