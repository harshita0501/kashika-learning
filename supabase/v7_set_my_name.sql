-- V7: users may change only their display name (never their role).
create function public.set_my_name(new_name text) returns void
language sql security definer set search_path = public as
$$ update public.profiles set full_name = left(btrim(new_name), 40) where id = auth.uid() and btrim(new_name) <> '' $$;
revoke execute on function public.set_my_name(text) from public, anon;
grant execute on function public.set_my_name(text) to authenticated;
