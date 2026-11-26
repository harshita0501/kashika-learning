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
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <span className="absolute top-10 left-8 text-4xl float">⭐</span>
      <span className="absolute top-24 right-10 text-3xl float" style={{ animationDelay: ".6s" }}>📚</span>
      <span className="absolute bottom-16 left-12 text-3xl float" style={{ animationDelay: "1.2s" }}>✏️</span>
      <span className="absolute bottom-10 right-8 text-4xl float" style={{ animationDelay: "1.8s" }}>🌈</span>
      <form onSubmit={submit} className="card w-full max-w-sm p-7 space-y-4 pop relative">
        <div className="text-center">
          <div className="text-7xl float inline-block">🦉</div>
          <h1 className="text-3xl font-extrabold mt-1">Kashika Learning</h1>
          <p className="text-slate-500 font-semibold">Let&apos;s learn something fun today!</p>
        </div>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" autoComplete="username" />
        <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" autoComplete="current-password" />
        {err && <p className="text-rose-600 text-sm font-bold shake">{err}</p>}
        <button disabled={busy} className="btn btn-primary btn-big">{busy ? "Logging in…" : "Let's go! 🚀"}</button>
      </form>
    </main>
  );
}
