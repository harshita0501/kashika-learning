"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase, today, uploadFile } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { SUBJECTS, subjectMeta } from "@/lib/constants";
import FileInput from "@/components/FileInput";
import FileKeeper from "@/components/FileKeeper";
import { ThumbGrid } from "@/components/Thumb";
import { Empty, ErrorBox, PageTitle, Ring, SubjectChip, Tabs } from "@/components/ui";
import { useTodo } from "@/lib/todo";

type T = { id: string; subject: string; title: string; test_date: string; syllabus: string; syllabus_files: string[]; marks_obtained: number | null; max_marks: number | null; file_paths: string[] };
type Paper = { test_id: string; file_paths: string[]; note: string };
type Ans = { test_id: string; file_paths: string[]; note: string; submitted_at: string };

export default function Tests() {
  const me = useMe();
  const todo = useTodo();
  const [tests, setTests] = useState<T[]>([]);
  const [papers, setPapers] = useState<Record<string, Paper>>({});
  const [answers, setAnswers] = useState<Record<string, Ans>>({});
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"up" | "past">("up");
  const [busy, setBusy] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [paperEdit, setPaperEdit] = useState<string | null>(null);
  const [ansEdit, setAnsEdit] = useState<string | null>(null);
  const [keep, setKeep] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [t, p, a] = await Promise.all([
      supabase.from("tests").select("*").order("test_date", { ascending: false }),
      supabase.from("test_papers").select("*"),
      supabase.from("test_submissions").select("*"),
    ]);
    setTests((t.data ?? []) as T[]);
    setPapers(Object.fromEntries((p.data ?? []).map((x) => [x.test_id, x as Paper])));
    setAnswers(Object.fromEntries((a.data ?? []).map((x) => [x.test_id, x as Ans])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const isTeacher = me.role === "teacher", isStudent = me.role === "student";
  const files = (f: FormData, name: string) => (f.getAll(name) as File[]).filter((x) => x.size);
  const up = (list: File[], folder: string) => Promise.all(list.map((x) => uploadFile(x, folder)));

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; const f = new FormData(form);
    setBusy("add"); setErr("");
    try {
      const syllabus_files = await up(files(f, "syllabus_photos"), "tests");
      const { error } = await supabase.from("tests").insert({
        subject: f.get("subject"), title: f.get("title"), test_date: f.get("date"), syllabus: f.get("syllabus"),
        max_marks: f.get("max") ? Number(f.get("max")) : null, syllabus_files,
      });
      if (error) throw error;
      form.reset(); load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function saveTest(t: T, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    setBusy(t.id); setErr("");
    try {
      const added = await up(files(f, "syllabus_photos"), "tests");
      const { error } = await supabase.from("tests").update({
        subject: f.get("subject"), title: f.get("title"), test_date: f.get("date"), syllabus: f.get("syllabus"),
        max_marks: f.get("max") ? Number(f.get("max")) : null, syllabus_files: [...keep, ...added],
      }).eq("id", t.id);
      if (error) throw error;
      setEditId(null); load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function setMarks(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget).get("marks");
    await supabase.from("tests").update({ marks_obtained: v === "" ? null : Number(v) }).eq("id", id);
    load(); todo.refresh();
  }
  async function addCheckedPaper(t: T, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const list = files(new FormData(e.currentTarget), "file");
    if (!list.length) return;
    setBusy(t.id + "chk"); setErr("");
    try {
      const paths = await up(list, "tests");
      const { error } = await supabase.from("tests").update({ file_paths: [...t.file_paths, ...paths] }).eq("id", t.id);
      if (error) throw error;
      load();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function removeChecked(t: T, p: string) {
    if (!confirm("Remove this photo?")) return;
    await supabase.from("tests").update({ file_paths: t.file_paths.filter((x) => x !== p) }).eq("id", t.id);
    load();
  }
  async function savePaper(t: T, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    setBusy(t.id + "paper"); setErr("");
    try {
      const added = await up(files(f, "paper"), "tests");
      const have = papers[t.id];
      const file_paths = [...(have ? keep : []), ...added];
      if (!file_paths.length) { setErr("Please add a photo or PDF of the test paper."); setBusy(null); return; }
      const { error } = await supabase.from("test_papers").upsert({ test_id: t.id, file_paths, note: (f.get("note") as string) ?? "" });
      if (error) throw error;
      setPaperEdit(null); load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function deletePaper(t: T) {
    if (!confirm("Remove the test paper?")) return;
    await supabase.from("test_papers").delete().eq("test_id", t.id); load(); todo.refresh();
  }
  async function saveAnswer(t: T, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    setBusy(t.id + "ans"); setErr("");
    try {
      const have = answers[t.id];
      const added = await up(files(f, "answer"), "test-answers");
      const file_paths = [...(have ? keep : []), ...added];
      if (!file_paths.length && !(f.get("note") as string).trim()) { setErr("Please add photos of your answer sheet."); setBusy(null); return; }
      const row = { test_id: t.id, file_paths, note: f.get("note") as string, submitted_at: new Date().toISOString() };
      const { error } = have ? await supabase.from("test_submissions").update(row).eq("test_id", t.id) : await supabase.from("test_submissions").insert(row);
      if (error) throw error;
      setAnsEdit(null); load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function deleteAnswer(t: T) {
    if (!confirm("Delete my answer sheet? You can upload it again.")) return;
    const { error } = await supabase.from("test_submissions").delete().eq("test_id", t.id);
    if (error) setErr(error.message); else { setAnsEdit(null); load(); todo.refresh(); }
  }
  async function remove(id: string) { if (confirm("Delete this test (with its paper and answer sheet)?")) { await supabase.from("tests").delete().eq("id", id); load(); todo.refresh(); } }

  const t0 = today();
  const upcoming = tests.filter((t) => t.test_date >= t0).reverse();
  const past = tests.filter((t) => t.test_date < t0);
  const daysTo = (d: string) => Math.round((new Date(d).getTime() - new Date(t0).getTime()) / 86400000);

  const Card = (t: T, i: number) => {
    const started = t.test_date <= t0;            // paper is visible to Kashika from the test date
    const isPast = t.test_date < t0;
    const paper = papers[t.id], ans = answers[t.id];
    const pct = t.marks_obtained !== null && t.max_marks ? Math.round((t.marks_obtained / t.max_marks) * 100) : null;
    const m = subjectMeta(t.subject);
    const today_ = t.test_date === t0;
    return (
      <article key={t.id} className={`card overflow-hidden fade-up ${today_ ? "ring-2 ring-rose-400" : ""}`} style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
        <div className={`h-2 bg-gradient-to-r ${m.grad}`} />
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SubjectChip subject={t.subject} />
            {today_ ? <span className="chip bg-rose-500 text-white animate-pulse">🔥 Test day!</span>
              : !isPast && <span className={`chip ${daysTo(t.test_date) <= 1 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>⏳ {daysTo(t.test_date) === 1 ? "Tomorrow" : `in ${daysTo(t.test_date)} days`}</span>}
            <span className="ml-auto text-xs font-bold text-slate-500">📅 {t.test_date}</span>
          </div>

          {editId === t.id ? (
            <form onSubmit={(e) => saveTest(t, e)} className="space-y-2.5 rounded-2xl bg-amber-50 border border-amber-200 p-3">
              <div className="font-extrabold">✏️ Edit test</div>
              <select name="subject" defaultValue={t.subject} className="field">{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</select>
              <input name="title" required defaultValue={t.title} className="field" />
              <div className="flex gap-2"><input type="date" name="date" required defaultValue={t.test_date} className="field" /><input name="max" type="number" defaultValue={t.max_marks ?? ""} placeholder="Total marks" className="field !w-36" /></div>
              <textarea name="syllabus" defaultValue={t.syllabus} placeholder="Syllabus / chapters" className="field" rows={2} />
              <FileKeeper paths={t.syllabus_files} keep={keep} setKeep={setKeep} label="Syllabus photos" />
              <FileInput name="syllabus_photos" multiple compact label="Add syllabus photos / PDF" />
              <div className="flex gap-2"><button disabled={busy === t.id} className="btn btn-primary flex-1">{busy === t.id ? "Saving…" : "Save changes"}</button><button type="button" onClick={() => setEditId(null)} className="btn btn-ghost">Cancel</button></div>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-extrabold text-xl leading-snug">{t.title}</h2>
                {t.syllabus && <p className="text-sm text-slate-600">📖 {t.syllabus}</p>}
              </div>
              {pct !== null && (
                <Ring value={pct} max={100} size={76} stroke={9} from={pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#fb7185"} to={pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444"}>
                  <div><div className="font-display font-extrabold text-sm leading-none">{t.marks_obtained}/{t.max_marks}</div><div className="text-[10px] font-bold text-slate-500">{pct}%</div></div>
                </Ring>
              )}
            </div>
          )}
          {editId !== t.id && t.syllabus_files.length > 0 && (
            <div className="space-y-1"><div className="text-xs font-extrabold text-slate-500">📚 Syllabus</div><ThumbGrid paths={t.syllabus_files} label="Syllabus" title={`${t.title} · syllabus`} /></div>
          )}

          {/* ---- the test paper ---- */}
          {isTeacher ? (
            <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3 space-y-2">
              <div className="font-extrabold text-sm">📄 Test paper {paper ? <span className="chip bg-emerald-100 text-emerald-800 ml-1">uploaded</span> : <span className="chip bg-slate-100 text-slate-600 ml-1">not uploaded</span>}</div>
              <p className="text-xs text-slate-600">Upload it any time. Kashika can open it only from the test date ({t.test_date}){started ? " — it is open now." : "."}</p>
              {paper && paperEdit !== t.id && (<><ThumbGrid paths={paper.file_paths} label="Paper" title={`${t.title} · test paper`} />{paper.note && <p className="text-sm">📝 {paper.note}</p>}</>)}
              {paperEdit === t.id ? (
                <form onSubmit={(e) => savePaper(t, e)} className="space-y-2">
                  {paper && <FileKeeper paths={paper.file_paths} keep={keep} setKeep={setKeep} label="Pages (tap ✕ to remove)" />}
                  <FileInput name="paper" multiple label={paper ? "Add more pages" : "Upload test paper (photos or PDF)"} />
                  <input name="note" defaultValue={paper?.note ?? ""} placeholder="Instructions for Kashika (optional)" className="field" />
                  <div className="flex gap-2"><button disabled={busy === t.id + "paper"} className="btn btn-primary flex-1">{busy === t.id + "paper" ? "Saving…" : "Save paper"}</button><button type="button" onClick={() => setPaperEdit(null)} className="btn btn-ghost">Cancel</button></div>
                </form>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setPaperEdit(t.id); setKeep(paper?.file_paths ?? []); }} className="btn btn-soft !py-1.5 text-sm">{paper ? "✏️ Edit paper" : "⬆️ Upload paper"}</button>
                  {paper && <button onClick={() => deletePaper(t)} className="btn btn-ghost !py-1.5 text-sm !text-rose-600">🗑 Remove</button>}
                </div>
              )}
            </div>
          ) : !started ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-sm font-bold text-slate-600">🔒 Your test paper will open on {t.test_date}. Revise well! 💪</div>
          ) : (
            <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3 space-y-2">
              <div className="font-extrabold text-sm">📄 Your test paper</div>
              {paper ? (<><ThumbGrid paths={paper.file_paths} label="Paper" title={`${t.title} · test paper`} />{paper.note && <p className="text-sm">📝 {paper.note}</p>}<p className="text-xs text-slate-500">Tap to open. Write your answers on paper, then upload photos of your answer sheet below.</p></>)
                : <p className="text-sm text-slate-600">Ma&apos;am has not uploaded the paper yet. Please wait. ⏳</p>}
            </div>
          )}

          {/* ---- Kashika's answer sheet ---- */}
          {(isTeacher || started) && (paper || ans) && (
            <div className="rounded-2xl bg-violet-50/70 border border-violet-100 p-3 space-y-2">
              <div className="font-extrabold text-sm">✍️ {isTeacher ? "Kashika's answer sheet" : "My answer sheet"} {ans && <span className="text-xs font-semibold text-slate-400">· {new Date(ans.submitted_at).toLocaleDateString()}</span>}</div>
              {ans && ansEdit !== t.id && (<>{ans.file_paths.length > 0 && <ThumbGrid paths={ans.file_paths} label="Page" title={`${isTeacher ? "Kashika's" : "My"} answer sheet · ${t.title}`} />}{ans.note && <p className="text-sm">{ans.note}</p>}</>)}
              {!ans && !isStudent && <p className="text-sm text-slate-500">Not submitted yet.</p>}
              {isStudent && (!ans || ansEdit === t.id) && t.marks_obtained === null && (
                <form onSubmit={(e) => saveAnswer(t, e)} className="space-y-2.5">
                  {ans && <FileKeeper paths={ans.file_paths} keep={keep} setKeep={setKeep} label="My pages (tap ✕ to remove one)" />}
                  <FileInput name="answer" multiple color="green" label={ans ? "Add more pages" : "Add photos of my answer sheet"} />
                  <input name="note" defaultValue={ans?.note ?? ""} placeholder="Note for ma'am (optional)" className="field" />
                  <div className="flex gap-2"><button disabled={busy === t.id + "ans"} className="btn btn-green btn-big flex-1">{busy === t.id + "ans" ? "Sending…" : ans ? "💾 Save changes" : "✅ Submit answer sheet"}</button>{ans && <button type="button" onClick={() => setAnsEdit(null)} className="btn btn-ghost">Cancel</button>}</div>
                </form>
              )}
              {isStudent && ans && ansEdit !== t.id && t.marks_obtained === null && (
                <div className="flex gap-2">
                  <button onClick={() => { setAnsEdit(t.id); setKeep(ans.file_paths); }} className="btn btn-soft flex-1 !py-2 text-sm">✏️ Edit my answer sheet</button>
                  <button onClick={() => deleteAnswer(t)} className="btn btn-ghost !py-2 text-sm !text-rose-600">🗑 Delete</button>
                </div>
              )}
            </div>
          )}

          {/* ---- marks + checked paper ---- */}
          {pct === null && isPast && !isTeacher && <p className="text-sm font-bold text-slate-400">Marks not added yet</p>}
          {t.file_paths.length > 0 && (
            <div className="space-y-1"><div className="text-xs font-extrabold text-slate-500">✅ Checked paper</div>
              <ThumbGrid paths={t.file_paths} label="Checked" title={`${t.title} · checked paper`} renderExtra={isTeacher ? (p) => (
                <button onClick={() => removeChecked(t, p)} className="absolute -top-2 -right-2 size-7 rounded-full bg-rose-500 text-white text-sm font-extrabold shadow" title="Remove photo">✕</button>) : undefined} />
            </div>
          )}
          {isTeacher && started && (
            <div className="space-y-2 border-t border-dashed border-violet-200 pt-3">
              <form onSubmit={(e) => setMarks(t.id, e)} className="flex items-center gap-2">
                <input name="marks" type="number" step="0.5" defaultValue={t.marks_obtained ?? ""} placeholder="Marks" className="field !w-28" />
                <span className="font-bold">/ {t.max_marks ?? "?"}</span>
                <button className="btn btn-soft">Save marks</button>
              </form>
              <form onSubmit={(e) => addCheckedPaper(t, e)} className="space-y-2">
                <FileInput name="file" multiple compact label="Add checked paper (photos)" />
                <button disabled={busy === t.id + "chk"} className="btn btn-soft !py-1.5 text-sm">{busy === t.id + "chk" ? "Uploading…" : "Upload checked paper"}</button>
              </form>
            </div>
          )}
          {isTeacher && editId !== t.id && (
            <div className="flex gap-2">
              <button onClick={() => { setEditId(t.id); setKeep(t.syllabus_files); }} className="btn btn-soft !py-1.5 text-sm">✏️ Edit test</button>
              <button onClick={() => remove(t.id)} className="btn btn-ghost !py-1.5 text-sm !text-rose-600">🗑 Delete</button>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-4">
      <PageTitle emoji="🏆" title="Tests" sub={isTeacher ? "Schedule, upload the paper, check answers" : "Syllabus, test paper and marks"} />
      {err && <ErrorBox>{err}</ErrorBox>}
      {isTeacher && (
        <details className="card p-4 fade-up">
          <summary className="font-extrabold cursor-pointer select-none">➕ Schedule a test</summary>
          <form onSubmit={add} className="space-y-2.5 mt-3">
            <select name="subject" className="field">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
            <input name="title" required placeholder="Test name (e.g. Unit Test 1)" className="field" />
            <div className="flex gap-2"><input type="date" name="date" required className="field" /><input name="max" type="number" placeholder="Total marks" className="field !w-36" /></div>
            <textarea name="syllabus" placeholder="Syllabus / chapters (you can also add photos below)" className="field" rows={2} />
            <FileInput name="syllabus_photos" multiple compact label="Add syllabus photos / PDF (optional)" />
            <button disabled={busy === "add"} className="btn btn-primary btn-big">{busy === "add" ? "Adding…" : "Add test"}</button>
            <p className="text-xs text-slate-500">On the test day, open the test and upload the question paper. Kashika will see it only from that date.</p>
          </form>
        </details>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "up", label: "Upcoming & today", count: upcoming.length }, { id: "past", label: "Past tests & marks" }]} />
      {tab === "up" && (upcoming.length ? upcoming.map(Card) : <Empty emoji="🌈" title="No upcoming tests" sub="Relax and keep learning!" />)}
      {tab === "past" && (past.length ? past.map(Card) : <Empty emoji="📭" title="No past tests yet" />)}
    </div>
  );
}
