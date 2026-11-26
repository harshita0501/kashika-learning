import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function serverClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => store.getAll(), setAll() {} },
  });
}

/** Returns the supabase client if the caller is the logged-in teacher, otherwise null. */
export async function teacherClient() {
  const supabase = await serverClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
  return p?.role === "teacher" ? supabase : null;
}
