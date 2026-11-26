"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { PageTitle } from "@/components/ui";

type Msg = { ok: boolean; text: string } | null;
const Note = ({ m }: { m: Msg }) => (m ? <p className={`text-sm font-bold pop ${m.ok ? "text-emerald-700" : "text-rose-600"}`}>{m.ok ? "✓ " : "✗ "}{m.text}</p> : null);

export default function Profile() {
  const me = useMe();
  const [email, setEmail] = useState("");
  const [name, setName] = useState(me.name);
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [m1, setM1] = useState<Msg>(null);
  const [m2, setM2] = useState<Msg>(null);
  const [m3, setM3] = useState<Msg>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? "")); }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault(); setBusy("name"); setM1(null);
    const { error } = await supabase.rpc("set_my_name", { new_name: name });
    setBusy("");
    if (error) setM1({ ok: false, text: error.message });
    else { setM1({ ok: true, text: "Name updated" }); setTimeout(() => window.location.reload(), 700); }
  }
  async function saveEmail(e: React.FormEvent) {
    e.preventDefault(); setBusy("email"); setM2(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setBusy("");
    if (error) setM2({ ok: false, text: error.message });
    else { setM2({ ok: true, text: `We sent a confirmation link to ${newEmail.trim()}. Open it to finish. Until then, keep logging in with ${email}.` }); setNewEmail(""); }
  }
  async function savePw(e: React.FormEvent) {
    e.preventDefault(); setM3(null);
    if (pw.length < 8) { setM3({ ok: false, text: "Password must be at least 8 characters." }); return; }
    if (pw !== pw2) { setM3({ ok: false, text: "The two passwords do not match." }); return; }
    setBusy("pw");
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy("");
    if (error) setM3({ ok: false, text: error.message });
    else { setM3({ ok: true, text: "Password changed. Use the new one next time you log in." }); setPw(""); setPw2(""); }
  }

  return (
    <div className="space-y-4">
      <PageTitle emoji="👤" title="My Profile" sub="Change your name, email or password" />

      <div className="card p-4 flex items-center gap-3 fade-up">
        <div className="size-14 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 grid place-items-center text-3xl">{me.role === "teacher" ? "👩‍🏫" : me.role === "student" ? "🧒" : "👪"}</div>
        <div className="min-w-0"><div className="font-display font-extrabold text-xl truncate">{me.name}</div><div className="text-sm text-slate-500 truncate">{email} · {me.role}</div></div>
      </div>

      <form onSubmit={saveName} className="card p-4 space-y-2.5 fade-up" style={{ animationDelay: ".05s" }}>
        <h2 className="font-display font-extrabold text-lg">✏️ Display name</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className="field" placeholder="Your name" />
        <button disabled={busy === "name" || !name.trim() || name.trim() === me.name} className="btn btn-primary">{busy === "name" ? "Saving…" : "Save name"}</button>
        <Note m={m1} />
      </form>

      <form onSubmit={saveEmail} className="card p-4 space-y-2.5 fade-up" style={{ animationDelay: ".1s" }}>
        <h2 className="font-display font-extrabold text-lg">📧 Login email</h2>
        <p className="text-sm text-slate-600">Current: <b>{email}</b>. A confirmation link is sent to the new address, so it must be a real inbox you can open.</p>
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className="field" placeholder="New email address" autoComplete="email" />
        <button disabled={busy === "email" || !newEmail.trim()} className="btn btn-primary">{busy === "email" ? "Sending…" : "Change email"}</button>
        <Note m={m2} />
      </form>

      <form onSubmit={savePw} className="card p-4 space-y-2.5 fade-up" style={{ animationDelay: ".15s" }}>
        <h2 className="font-display font-extrabold text-lg">🔑 Password</h2>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="field" placeholder="New password (8+ characters)" autoComplete="new-password" />
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="field" placeholder="Type it again" autoComplete="new-password" />
        <button disabled={busy === "pw" || !pw} className="btn btn-primary">{busy === "pw" ? "Saving…" : "Change password"}</button>
        <Note m={m3} />
      </form>

      <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }} className="btn btn-ghost btn-big">🚪 Log out</button>
    </div>
  );
}
