-- V6: Kashika can delete her own answer until ma'am has checked it.
create policy "student deletes own answer" on public.submissions for delete
  using (public.my_role() = 'student' and status <> 'checked');
