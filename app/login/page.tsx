"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr("Wrong email or password");
      setBusy(false);
    } else {
      window.location.assign("/");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-8 space-y-4">
        <div className="text-center">
          <div className="text-5xl">📚</div>
          <h1 className="text-2xl font-bold mt-2">Kashika Learning</h1>
          <p className="text-gray-500 text-sm">Please log in</p>
        </div>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-xl px-4 py-3" />
        <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-xl px-4 py-3" />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button disabled={busy} className="w-full bg-indigo-600 text-white font-semibold rounded-xl py-3 disabled:opacity-50">
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
