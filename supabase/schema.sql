-- Kashika Learning — V1 schema. Run this once in Supabase → SQL Editor.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  role text not null default 'student' check (role in ('student','teacher','parent'))
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  zoom_link text not null default '',
  class_time text not null default ''
);
insert into public.settings (id) values (1);

create table public.attendance (
  day date primary key,
  status text not null check (status in ('present','absent','holiday')),
  note text not null default ''
);

create table public.homework (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  title text not null,
  description text not null default '',
  due_date date,
  file_path text,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homework on delete cascade,
  file_path text,
  note text not null default '',
  status text not null default 'submitted' check (status in ('submitted','checked','redo')),
  marks numeric,
  comment text not null default '',
  submitted_at timestamptz not null default now()
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  title text not null,
  test_date date not null,
  syllabus text not null default '',
  marks_obtained numeric,
  max_marks numeric
);

-- Helper: role of the logged-in user
create function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

-- Auto-create a profile (role = student) for every new user
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.attendance enable row level security;
alter table public.homework enable row level security;
alter table public.submissions enable row level security;
alter table public.tests enable row level security;

create policy "own profile" on public.profiles for select using (id = auth.uid());

create policy "read settings" on public.settings for select using (auth.uid() is not null);
create policy "teacher settings" on public.settings for update using (public.my_role() = 'teacher');

create policy "read attendance" on public.attendance for select using (auth.uid() is not null);
create policy "teacher attendance" on public.attendance for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');

create policy "read homework" on public.homework for select using (auth.uid() is not null);
create policy "teacher homework" on public.homework for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');

create policy "read submissions" on public.submissions for select using (auth.uid() is not null);
create policy "student submits" on public.submissions for insert with check (public.my_role() = 'student');
create policy "student resubmits" on public.submissions for update
  using (public.my_role() = 'student') with check (public.my_role() = 'student');
create policy "teacher checks" on public.submissions for update
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');

create policy "read tests" on public.tests for select using (auth.uid() is not null);
create policy "teacher tests" on public.tests for all
  using (public.my_role() = 'teacher') with check (public.my_role() = 'teacher');

-- Private file storage (homework files + answer photos)
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false);
create policy "read uploads" on storage.objects for select
  using (bucket_id = 'uploads' and auth.uid() is not null);
create policy "upload files" on storage.objects for insert
  with check (bucket_id = 'uploads' and public.my_role() in ('student','teacher'));

-- After creating the 3 users (Authentication → Users), set their roles, e.g.:
-- update public.profiles set role='teacher', full_name='Ma''am' where id = (select id from auth.users where email='maam@example.com');
-- update public.profiles set role='parent',  full_name='Parent' where id = (select id from auth.users where email='parent@example.com');
-- update public.profiles set role='student', full_name='Kashika' where id = (select id from auth.users where email='kashika@example.com');
