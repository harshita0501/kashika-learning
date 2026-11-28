"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, uploadFile } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { SUBJECTS, subjectMeta } from "@/lib/constants";
import FileInput from "@/components/FileInput";
import { ThumbGrid } from "@/components/Thumb";
import FileKeeper from "@/components/FileKeeper";
import { Empty, ErrorBox, PageTitle, SubjectChip, Tabs } from "@/components/ui";
import { useTodo } from "@/lib/todo";

type Hw = { id: string; subject: string; title: string; description: string; due_date: string | null; file_paths: string[]; created_at: string };
type Sub = { id: string; homework_id: string; file_paths: string[]; note: string; status: "submitted" | "checked" | "redo"; marks: number | null; comment: string; comment_files: string[]; submitted_at: string };

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
  const [tab, setTab] = useState<"todo" | "open" | "done" | "all">("todo");
  const [subject, setSubject] = useState<string>("All");
  const [editHw, setEditHw] = useState<string | null>(null); // homework being edited by ma'am
  const [editAns, setEditAns] = useState<string | null>(null); // homework whose answer Kashika is editing
  const [keep, setKeep] = useState<string[]>([]);

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
  const inOpen = (h: Hw) => ["pending", "redo"].includes(stateOf(h)); // given, waiting for Kashika
  const inDone = (h: Hw) => (isTeacher ? stateOf(h) === "checked" : ["submitted", "checked"].includes(stateOf(h)));

  const shown = useMemo(() => hws.filter((h) => (subject === "All" || h.subject === subject) && (tab === "all" || (tab === "todo" ? inTodo(h) : tab === "open" ? inOpen(h) : inDone(h)))),
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
      form.reset(); setTab("open"); setSubject("All"); load(); todo.refresh();
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
      const added = await Promise.all(files.map((x) => uploadFile(x, "answers")));
      const file_paths = [...(existing ? keep : []), ...added];
      if (!file_paths.length && !(f.get("note") as string).trim()) { setErr("Please add a photo/file or a note."); setBusy(null); return; }
      const row = { homework_id: hw.id, file_paths, file_path: file_paths[0] ?? null, note: f.get("note") as string, status: "submitted", submitted_at: new Date().toISOString() };
      const { error } = existing ? await supabase.from("submissions").update(row).eq("id", existing.id) : await supabase.from("submissions").insert(row);
      if (error) throw error;
      setEditAns(null); load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }

  async function deleteAnswer(s: Sub) {
    if (!confirm("Delete my answer? You can submit it again later.")) return;
    const { error } = await supabase.from("submissions").delete().eq("id", s.id);
    if (error) { setErr(error.message); return; }
    setEditAns(null); load(); todo.refresh();
  }

  async function saveHomework(h: Hw, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr(""); setBusy(h.id);
    try {
      const files = (f.getAll("file") as File[]).filter((x) => x.size);
      const added = await Promise.all(files.map((x) => uploadFile(x, "homework")));
      const file_paths = [...keep, ...added];
      const { error } = await supabase.from("homework").update({
        subject: f.get("subject"), title: f.get("title"), description: f.get("description"),
        due_date: f.get("due") || null, file_paths, file_path: file_paths[0] ?? null,
      }).eq("id", h.id);
      if (error) throw error;
      setEditHw(null); load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }

  async function deleteHomework(h: Hw) {
    const has = !!subs[h.id];
    if (!confirm(`Delete "${h.title}"?${has ? "\n\nKashika's answer and your marks for it will also be deleted." : ""}`)) return;
    const { error } = await supabase.from("homework").delete().eq("id", h.id);
    if (error) { setErr(error.message); return; }
    load(); todo.refresh();
  }

  async function check(sub: Sub, form: HTMLFormElement, status: "checked" | "redo") {
    const f = new FormData(form);
    const marks = f.get("marks");
    setErr(""); setBusy(sub.id + "chk");
    try {
      const added = await Promise.all((f.getAll("comment_photos") as File[]).filter((x) => x.size).map((x) => uploadFile(x, "remarks")));
      const { error } = await supabase.from("submissions").update({
        status, marks: marks === "" || marks === null ? null : Number(marks), comment: f.get("comment"), comment_files: [...(sub.comment_files ?? []), ...added],
      }).eq("id", sub.id);
      if (error) throw error;
      load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function removeCommentFile(sub: Sub, p: string) {
    if (!confirm("Remove this photo from your remarks?")) return;
    await supabase.from("submissions").update({ comment_files: sub.comment_files.filter((x) => x !== p) }).eq("id", sub.id);
    load();
  }

  const counts = { todo: hws.filter(inTodo).length, open: hws.filter(inOpen).length };

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

      <Tabs value={tab} onChange={setTab} tabs={isTeacher ? [
        { id: "todo", label: "To check", count: counts.todo },
        { id: "open", label: "Given", count: counts.open },
        { id: "done", label: "Checked" },
        { id: "all", label: "All" },
      ] : [
        { id: "todo", label: "To do", count: counts.todo },
        { id: "done", label: "Done" },
        { id: "all", label: "All" },
      ]} />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {["All", ...SUBJECTS].map((s) => (
          <button key={s} onClick={() => setSubject(s)} className={`chip whitespace-nowrap !text-sm !py-1.5 transition ${subject === s ? "bg-violet-600 text-white shadow" : "bg-white text-slate-600 border border-violet-100"}`}>
            {s === "All" ? "🌈 All" : `${subjectMeta(s).icon} ${s}`}
          </button>
        ))}
      </div>

      {shown.length === 0 && <Empty emoji={tab === "todo" ? "🎉" : "📭"} title={tab === "todo" ? (isTeacher ? "Nothing to check!" : "No homework pending!") : tab === "open" ? "No homework waiting for Kashika" : "Nothing here yet"} sub={tab === "todo" ? "Enjoy your free time ✨" : "Switch the tab or subject to see more"} />}

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
              {editHw === h.id ? (
                <form onSubmit={(e) => saveHomework(h, e)} className="space-y-2.5 rounded-2xl bg-amber-50 border border-amber-200 p-3">
                  <div className="font-extrabold">✏️ Edit homework</div>
                  <select name="subject" defaultValue={h.subject} className="field">{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</select>
                  <input name="title" required defaultValue={h.title} className="field" />
                  <textarea name="description" defaultValue={h.description} placeholder="Instructions (optional)" className="field" rows={2} />
                  <label className="block text-sm font-bold">Due date <input type="date" name="due" defaultValue={h.due_date ?? ""} className="field !w-auto ml-2" /></label>
                  <FileKeeper paths={h.file_paths} keep={keep} setKeep={setKeep} label="Files" />
                  <FileInput name="file" multiple label="Add more photos / files" />
                  <div className="flex gap-2">
                    <button disabled={busy === h.id} className="btn btn-primary flex-1">{busy === h.id ? "Saving…" : "Save changes"}</button>
                    <button type="button" onClick={() => setEditHw(null)} className="btn btn-ghost">Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <h2 className="font-display font-extrabold text-xl leading-snug">{h.title}</h2>
                  {h.description && <p className="text-sm text-slate-600 whitespace-pre-wrap">{h.description}</p>}
                  <ThumbGrid paths={h.file_paths} label="Homework" title={h.title} />
                  {isTeacher && (
                    <div className="flex gap-2">
                      <button onClick={() => { setEditHw(h.id); setKeep(h.file_paths); }} className="btn btn-soft !py-1.5 text-sm">✏️ Edit</button>
                      <button onClick={() => deleteHomework(h)} className="btn btn-ghost !py-1.5 text-sm !text-rose-600">🗑 Delete</button>
                    </div>
                  )}
                </>
              )}

              {s && (
                <div className="rounded-2xl bg-violet-50/70 border border-violet-100 p-3 space-y-2">
                  <div className="font-extrabold text-sm">{isTeacher ? "Kashika's answer" : "My answer"} <span className="text-xs font-semibold text-slate-400">· {new Date(s.submitted_at).toLocaleDateString()}</span></div>
                  {s.note && <p className="text-sm">{s.note}</p>}
                  <ThumbGrid paths={s.file_paths} label="Page" title={`${isTeacher ? "Kashika's answer" : "My answer"} · ${h.title}`} />
                  {s.status !== "submitted" && (
                    <div className={`rounded-xl px-3 py-2 text-sm ${s.status === "checked" ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
                      {s.marks !== null && <b className="mr-2">⭐ Marks: {s.marks}</b>}
                      {s.comment && <>👩‍🏫 “{s.comment}”</>}
                      {s.marks === null && !s.comment && (s.comment_files?.length ?? 0) === 0 && (s.status === "redo" ? "Please try again." : "Checked!")}
                    </div>
                  )}
                  {(s.comment_files?.length ?? 0) > 0 && s.status !== "submitted" && (
                    <div className="space-y-1"><div className="text-xs font-extrabold text-slate-500">📎 Ma&apos;am&apos;s remarks (photos)</div>
                      <ThumbGrid paths={s.comment_files} label="Remark" title={`Ma'am's remarks · ${h.title}`} renderExtra={isTeacher ? (p) => (
                        <button onClick={() => removeCommentFile(s, p)} className="absolute -top-2 -right-2 size-7 rounded-full bg-rose-500 text-white text-sm font-extrabold shadow" title="Remove photo">✕</button>) : undefined} />
                    </div>
                  )}
                </div>
              )}

              {me.role === "student" && s && s.status !== "checked" && editAns !== h.id && (
                <div className="flex gap-2">
                  <button onClick={() => { setEditAns(h.id); setKeep(s.file_paths); }} className="btn btn-soft flex-1 !py-2 text-sm">✏️ Edit my answer</button>
                  <button onClick={() => deleteAnswer(s)} className="btn btn-ghost !py-2 text-sm !text-rose-600">🗑 Delete</button>
                </div>
              )}
              {me.role === "student" && (!s || (s.status !== "checked" && editAns === h.id)) && (
                <form onSubmit={(e) => submitAnswer(h, e)} className="space-y-2.5 border-t border-dashed border-violet-200 pt-3">
                  {s && <FileKeeper paths={s.file_paths} keep={keep} setKeep={setKeep} label="My pages (tap ✕ to remove one)" />}
                  <FileInput name="file" multiple color="green" label={s ? "Add more pages" : "Add photo of your answer"} />
                  <input name="note" placeholder="Note for ma'am (optional)" defaultValue={s?.note} className="field" />
                  <div className="flex gap-2">
                    <button disabled={busy === h.id} className="btn btn-green btn-big flex-1">{busy === h.id ? "Sending…" : s ? "💾 Save changes" : "✅ Submit answer"}</button>
                    {s && <button type="button" onClick={() => setEditAns(null)} className="btn btn-ghost">Cancel</button>}
                  </div>
                </form>
              )}

              {isTeacher && s && (
                <form className="space-y-2 border-t border-dashed border-violet-200 pt-3" onSubmit={(e) => e.preventDefault()}>
                  <div className="flex gap-2">
                    <input name="marks" type="number" step="0.5" placeholder="Marks" defaultValue={s.marks ?? ""} className="field !w-28" />
                    <input name="comment" placeholder="Comment for Kashika" defaultValue={s.comment} className="field" />
                  </div>
                  <FileInput name="comment_photos" multiple compact label="Add photos with your remarks (corrections, example)" />
                  <div className="flex gap-2">
                    <button type="button" disabled={busy === s.id + "chk"} onClick={(e) => check(s, e.currentTarget.form!, "checked")} className="btn btn-green flex-1">{busy === s.id + "chk" ? "Saving…" : "✔ Mark checked"}</button>
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
