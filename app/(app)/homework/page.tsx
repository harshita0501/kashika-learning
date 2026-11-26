"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase, uploadFile, fileUrl } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { SUBJECTS, SUBJECT_STYLE } from "@/lib/constants";

type Hw = { id: string; subject: string; title: string; description: string; due_date: string | null; file_path: string | null };
type Sub = { id: string; homework_id: string; file_path: string | null; note: string; status: "submitted" | "checked" | "redo"; marks: number | null; comment: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-gray-100 text-gray-700" },
  submitted: { label: "Submitted", cls: "bg-blue-100 text-blue-800" },
  checked: { label: "Checked ✓", cls: "bg-green-100 text-green-800" },
  redo: { label: "Redo", cls: "bg-red-100 text-red-800" },
};

function FileLink({ path, label }: { path: string; label: string }) {
  return <button className="text-indigo-600 underline text-sm" onClick={async () => { const u = await fileUrl(path); if (u) window.open(u, "_blank"); }}>{label}</button>;
}

export default function Homework() {
  const me = useMe();
  const [hws, setHws] = useState<Hw[]>([]);
  const [subs, setSubs] = useState<Record<string, Sub>>({});
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [h, s] = await Promise.all([
      supabase.from("homework").select("*").order("created_at", { ascending: false }),
      supabase.from("submissions").select("*"),
    ]);
    setHws(h.data ?? []);
    setSubs(Object.fromEntries((s.data ?? []).map((x) => [x.homework_id, x as Sub])));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addHomework(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setErr("");
    try {
      const file = f.get("file") as File;
      const file_path = file && file.size ? await uploadFile(file, "homework") : null;
      const { error } = await supabase.from("homework").insert({
        subject: f.get("subject"), title: f.get("title"), description: f.get("description"),
        due_date: f.get("due") || null, file_path,
      });
      if (error) throw error;
      form.reset();
      load();
    } catch (x) { setErr((x as Error).message); }
  }

  async function submitAnswer(hw: Hw, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr("");
    try {
      const file = f.get("file") as File;
      const existing = subs[hw.id];
      const file_path = file && file.size ? await uploadFile(file, "answers") : existing?.file_path ?? null;
      if (!file_path && !f.get("note")) { setErr("Please add a photo/file or a note."); return; }
      const row = { homework_id: hw.id, file_path, note: f.get("note") as string, status: "submitted", submitted_at: new Date().toISOString() };
      const { error } = existing
        ? await supabase.from("submissions").update(row).eq("id", existing.id)
        : await supabase.from("submissions").insert(row);
      if (error) throw error;
      load();
    } catch (x) { setErr((x as Error).message); }
  }

  async function check(sub: Sub, e: React.FormEvent<HTMLFormElement>, status: "checked" | "redo") {
    e.preventDefault();
    const f = new FormData(e.currentTarget.form ?? (e.currentTarget as HTMLFormElement));
    const marks = f.get("marks");
    await supabase.from("submissions").update({ status, marks: marks === "" || marks === null ? null : Number(marks), comment: f.get("comment") }).eq("id", sub.id);
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">📝 Homework</h1>
      {err && <p className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{err}</p>}

      {me.role === "teacher" && (
        <details className="bg-white rounded-2xl p-4 shadow-sm">
          <summary className="font-semibold cursor-pointer">➕ Add new homework</summary>
          <form onSubmit={addHomework} className="space-y-2 mt-3">
            <select name="subject" className="w-full border rounded-xl px-3 py-2">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
            <input name="title" required placeholder="Title (e.g. Exercise 3.2)" className="w-full border rounded-xl px-3 py-2" />
            <textarea name="description" placeholder="Instructions (optional)" className="w-full border rounded-xl px-3 py-2" />
            <label className="block text-sm">Due date <input type="date" name="due" className="border rounded-xl px-3 py-2 ml-2" /></label>
            <label className="block text-sm">File/photo (optional) <input type="file" name="file" className="block mt-1" /></label>
            <button className="bg-indigo-600 text-white rounded-xl px-5 py-2 font-semibold">Add homework</button>
          </form>
        </details>
      )}

      {hws.length === 0 && <p className="text-gray-500">No homework yet.</p>}
      {hws.map((h) => {
        const s = subs[h.id];
        const st = STATUS[s ? s.status : "pending"];
        return (
          <article key={h.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${SUBJECT_STYLE[h.subject]}`}>{h.subject}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
              {h.due_date && <span className="text-xs text-gray-500 ml-auto">Due {h.due_date}</span>}
            </div>
            <h2 className="font-bold">{h.title}</h2>
            {h.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{h.description}</p>}
            {h.file_path && <FileLink path={h.file_path} label="📎 Open homework file" />}

            {s && (
              <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                <div className="font-semibold">Kashika&apos;s answer</div>
                {s.note && <p>{s.note}</p>}
                {s.file_path && <FileLink path={s.file_path} label="📷 Open answer" />}
                {s.status !== "submitted" && (
                  <p className="pt-1">{s.marks !== null && <b>Marks: {s.marks} </b>}{s.comment && <>· Ma&apos;am: “{s.comment}”</>}</p>
                )}
              </div>
            )}

            {me.role === "student" && (!s || s.status !== "checked") && (
              <form onSubmit={(e) => submitAnswer(h, e)} className="space-y-2 border-t pt-2">
                <input type="file" name="file" accept="image/*,application/pdf" className="block text-sm" />
                <input name="note" placeholder="Note for ma'am (optional)" defaultValue={s?.note} className="w-full border rounded-xl px-3 py-2 text-sm" />
                <button className="bg-green-600 text-white rounded-xl px-5 py-2 font-semibold">{s ? "Submit again" : "Submit answer"}</button>
              </form>
            )}

            {me.role === "teacher" && s && (
              <form className="space-y-2 border-t pt-2" onSubmit={(e) => e.preventDefault()}>
                <input name="marks" type="number" step="0.5" placeholder="Marks" defaultValue={s.marks ?? ""} className="border rounded-xl px-3 py-2 w-28 text-sm" />
                <input name="comment" placeholder="Comment for Kashika" defaultValue={s.comment} className="w-full border rounded-xl px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button type="button" onClick={(e) => check(s, e as never, "checked")} className="bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-semibold">Mark checked</button>
                  <button type="button" onClick={(e) => check(s, e as never, "redo")} className="bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-semibold">Ask to redo</button>
                </div>
              </form>
            )}
          </article>
        );
      })}
    </div>
  );
}
