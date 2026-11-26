"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, uploadFile } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { SUBJECTS, subjectMeta } from "@/lib/constants";
import FileInput from "@/components/FileInput";
import Thumb from "@/components/Thumb";
import { Empty, ErrorBox, PageTitle, SubjectChip, Tabs } from "@/components/ui";
import { useTodo } from "@/lib/todo";

type Hw = { id: string; subject: string; title: string; description: string; due_date: string | null; file_paths: string[]; created_at: string };
type Sub = { id: string; homework_id: string; file_paths: string[]; note: string; status: "submitted" | "checked" | "redo"; marks: number | null; comment: string; submitted_at: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "To do", cls: "bg-slate-100 text-slate-700" },
  submitted: { label: "Submitted ✓", cls: "bg-sky-100 text-sky-800" },
  checked: { label: "Checked ✓✓", cls: "bg-emerald-100 text-emerald-800" },
  redo: { label: "Redo 🔁", cls: "bg-rose-100 text-rose-800" },
};

export default function Homework() {
  const me = useMe();
  const todo = useTodo();
  const [hws, setHws] = useState<Hw[]>([]);
  const [subs, setSubs] = useState<Record<string, Sub>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"todo" | "done" | "all">("todo");
  const [subject, setSubject] = useState<string>("All");

  const load = useCallback(async () => {
    const [h, s] = await Promise.all([
      supabase.from("homework").select("*").order("created_at", { ascending: false }),
      supabase.from("submissions").select("*"),
    ]);
    setHws((h.data ?? []) as Hw[]);
    setSubs(Object.fromEntries((s.data ?? []).map((x) => [x.homework_id, x as Sub])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const isTeacher = me.role === "teacher";
  const stateOf = (h: Hw) => subs[h.id]?.status ?? "pending";
  // teacher: "To check" = submitted/redo-resubmitted; "Done" = checked. Student: To do = pending/redo.
  const inTodo = (h: Hw) => (isTeacher ? stateOf(h) === "submitted" : ["pending", "redo"].includes(stateOf(h)));
  const inDone = (h: Hw) => (isTeacher ? stateOf(h) === "checked" : ["submitted", "checked"].includes(stateOf(h)));

  const shown = useMemo(() => hws.filter((h) => (subject === "All" || h.subject === subject) && (tab === "all" || (tab === "todo" ? inTodo(h) : inDone(h)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hws, subs, tab, subject, isTeacher]);

  async function addHomework(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setErr(""); setBusy("add");
    try {
      const files = (f.getAll("file") as File[]).filter((x) => x.size);
      const file_paths = await Promise.all(files.map((x) => uploadFile(x, "homework")));
      const { error } = await supabase.from("homework").insert({
        subject: f.get("subject"), title: f.get("title"), description: f.get("description"),
        due_date: f.get("due") || null, file_paths, file_path: file_paths[0] ?? null,
      });
      if (error) throw error;
      form.reset(); load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }

  async function submitAnswer(hw: Hw, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr(""); setBusy(hw.id);
    try {
      const files = (f.getAll("file") as File[]).filter((x) => x.size);
      const existing = subs[hw.id];
      const file_paths = files.length ? await Promise.all(files.map((x) => uploadFile(x, "answers"))) : existing?.file_paths ?? [];
      if (!file_paths.length && !f.get("note")) { setErr("Please add a photo/file or a note."); setBusy(null); return; }
      const row = { homework_id: hw.id, file_paths, file_path: file_paths[0] ?? null, note: f.get("note") as string, status: "submitted", submitted_at: new Date().toISOString() };
      const { error } = existing ? await supabase.from("submissions").update(row).eq("id", existing.id) : await supabase.from("submissions").insert(row);
      if (error) throw error;
      load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }

  async function check(sub: Sub, form: HTMLFormElement, status: "checked" | "redo") {
    const f = new FormData(form);
    const marks = f.get("marks");
    await supabase.from("submissions").update({ status, marks: marks === "" || marks === null ? null : Number(marks), comment: f.get("comment") }).eq("id", sub.id);
    load(); todo.refresh();
  }

  const counts = { todo: hws.filter(inTodo).length, done: hws.filter(inDone).length };

  return (
    <div className="space-y-4">
      <PageTitle emoji="📝" title="Homework" sub={isTeacher ? "Give homework and check answers" : "Do it, snap it, send it!"} />
      {err && <ErrorBox>{err}</ErrorBox>}

      {isTeacher && (
        <details className="card p-4 fade-up">
          <summary className="font-extrabold cursor-pointer select-none">➕ Add new homework</summary>
          <form onSubmit={addHomework} className="space-y-2.5 mt-3">
            <select name="subject" className="field">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
            <input name="title" required placeholder="Title (e.g. Exercise 3.2)" className="field" />
            <textarea name="description" placeholder="Instructions (optional)" className="field" rows={2} />
            <label className="block text-sm font-bold">Due date <input type="date" name="due" className="field !w-auto ml-2" /></label>
            <FileInput name="file" multiple label="Add homework photo / file (optional)" />
            <button disabled={busy === "add"} className="btn btn-primary btn-big">{busy === "add" ? "Adding…" : "Add homework"}</button>
          </form>
        </details>
      )}

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "todo", label: isTeacher ? "To check" : "To do", count: counts.todo },
        { id: "done", label: isTeacher ? "Checked" : "Done" },
        { id: "all", label: "All" },
      ]} />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {["All", ...SUBJECTS].map((s) => (
          <button key={s} onClick={() => setSubject(s)} className={`chip whitespace-nowrap !text-sm !py-1.5 transition ${subject === s ? "bg-violet-600 text-white shadow" : "bg-white text-slate-600 border border-violet-100"}`}>
            {s === "All" ? "🌈 All" : `${subjectMeta(s).icon} ${s}`}
          </button>
        ))}
      </div>

      {shown.length === 0 && <Empty emoji={tab === "todo" ? "🎉" : "📭"} title={tab === "todo" ? (isTeacher ? "Nothing to check!" : "No homework pending!") : "Nothing here yet"} sub={tab === "todo" ? "Enjoy your free time ✨" : "Switch the tab or subject to see more"} />}

      {shown.map((h, idx) => {
        const s = subs[h.id];
        const st = STATUS[s ? s.status : "pending"];
        const m = subjectMeta(h.subject);
        const late = h.due_date && !s && h.due_date < new Date().toLocaleDateString("en-CA");
        return (
          <article key={h.id} className="card overflow-hidden fade-up" style={{ animationDelay: `${Math.min(idx, 8) * 0.05}s` }}>
            <div className={`h-2 bg-gradient-to-r ${m.grad}`} />
            <div className="p-4 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <SubjectChip subject={h.subject} />
                <span className={`chip ${st.cls}`}>{st.label}</span>
                {h.due_date && <span className={`chip ml-auto ${late ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>📅 {h.due_date}{late ? " · late" : ""}</span>}
              </div>
              <h2 className="font-display font-extrabold text-xl leading-snug">{h.title}</h2>
              {h.description && <p className="text-sm text-slate-600 whitespace-pre-wrap">{h.description}</p>}
              {h.file_paths.length > 0 && <div className="flex flex-wrap gap-2">{h.file_paths.map((p) => <Thumb key={p} path={p} label="Homework" />)}</div>}

              {s && (
                <div className="rounded-2xl bg-violet-50/70 border border-violet-100 p-3 space-y-2">
                  <div className="font-extrabold text-sm">{isTeacher ? "Kashika's answer" : "My answer"} <span className="text-xs font-semibold text-slate-400">· {new Date(s.submitted_at).toLocaleDateString()}</span></div>
                  {s.note && <p className="text-sm">{s.note}</p>}
                  {s.file_paths.length > 0 && <div className="flex flex-wrap gap-2">{s.file_paths.map((p, i) => <Thumb key={p} path={p} label={`Page ${i + 1}`} />)}</div>}
                  {s.status !== "submitted" && (
                    <div className={`rounded-xl px-3 py-2 text-sm ${s.status === "checked" ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
                      {s.marks !== null && <b className="mr-2">⭐ Marks: {s.marks}</b>}
                      {s.comment && <>👩‍🏫 “{s.comment}”</>}
                      {s.marks === null && !s.comment && (s.status === "redo" ? "Please try again." : "Checked!")}
                    </div>
                  )}
                </div>
              )}

              {me.role === "student" && (!s || s.status !== "checked") && (
                <form onSubmit={(e) => submitAnswer(h, e)} className="space-y-2.5 border-t border-dashed border-violet-200 pt-3">
                  <FileInput name="file" multiple color="green" label="Add photo of your answer" />
                  <input name="note" placeholder="Note for ma'am (optional)" defaultValue={s?.note} className="field" />
                  <button disabled={busy === h.id} className="btn btn-green btn-big">{busy === h.id ? "Sending…" : s ? "Submit again" : "✅ Submit answer"}</button>
                </form>
              )}

              {isTeacher && s && (
                <form className="space-y-2 border-t border-dashed border-violet-200 pt-3" onSubmit={(e) => e.preventDefault()}>
                  <div className="flex gap-2">
                    <input name="marks" type="number" step="0.5" placeholder="Marks" defaultValue={s.marks ?? ""} className="field !w-28" />
                    <input name="comment" placeholder="Comment for Kashika" defaultValue={s.comment} className="field" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={(e) => check(s, e.currentTarget.form!, "checked")} className="btn btn-green flex-1">✔ Mark checked</button>
                    <button type="button" onClick={(e) => check(s, e.currentTarget.form!, "redo")} className="btn btn-red flex-1">🔁 Redo</button>
                  </div>
                </form>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
