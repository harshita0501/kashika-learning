"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase, today } from "./supabase";
import type { Role } from "./constants";

export type TodoItem = { href: string; icon: string; title: string; sub: string };
export type Todo = {
  items: TodoItem[];
  counts: { homework: number; quizzes: number; speaking: number; tests: number; flashcards: number };
  refresh: () => void;
};
const empty: Todo = { items: [], counts: { homework: 0, quizzes: 0, speaking: 0, tests: 0, flashcards: 0 }, refresh: () => {} };
const Ctx = createContext<Todo>(empty);
export const useTodo = () => useContext(Ctx);

const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

export function TodoProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  const [state, setState] = useState<Omit<Todo, "refresh">>(empty);

  const refresh = useCallback(async () => {
    const t = today();
    const items: TodoItem[] = [];
    const counts = { homework: 0, quizzes: 0, speaking: 0, tests: 0, flashcards: 0 };

    if (role === "teacher") {
      const [subs, qd, sd, att, fd] = await Promise.all([
        supabase.from("submissions").select("id").eq("status", "submitted"),
        supabase.from("quizzes").select("id").eq("status", "draft"),
        supabase.from("speaking_sets").select("id").eq("status", "draft"),
        supabase.from("speaking_attempts").select("id").is("teacher_score", null),
        supabase.from("flashcard_sets").select("id").eq("status", "draft"),
      ]);
      counts.flashcards = fd.data?.length ?? 0;
      counts.homework = subs.data?.length ?? 0;
      counts.quizzes = qd.data?.length ?? 0;
      counts.speaking = (sd.data?.length ?? 0) + (att.data?.length ?? 0);
      if (counts.homework) items.push({ href: "/homework", icon: "📝", title: `${counts.homework} homework to check`, sub: "Kashika has submitted answers" });
      if (qd.data?.length) items.push({ href: "/quizzes", icon: "🧠", title: `${qd.data.length} quiz draft${qd.data.length > 1 ? "s" : ""} to review`, sub: "Review and assign to Kashika" });
      if (sd.data?.length) items.push({ href: "/speaking", icon: "🎤", title: `${sd.data.length} speaking draft${sd.data.length > 1 ? "s" : ""} to review`, sub: "Review and assign to Kashika" });
      if (fd.data?.length) items.push({ href: "/flashcards", icon: "🃏", title: `${fd.data.length} flashcard set${fd.data.length > 1 ? "s" : ""} to review`, sub: "Review and assign to Kashika" });
      if (att.data?.length) items.push({ href: "/speaking", icon: "🎧", title: `${att.data.length} speaking recording${att.data.length > 1 ? "s" : ""} to listen to`, sub: "Check the AI marks and add yours" });
    } else {
      const [hw, subs, qz, qa, ss, sa, ts, fs, fp] = await Promise.all([
        supabase.from("homework").select("id, subject, title, due_date"),
        supabase.from("submissions").select("homework_id, status"),
        supabase.from("quizzes").select("id, subject, topic"),
        supabase.from("quiz_attempts").select("quiz_id"),
        supabase.from("speaking_sets").select("id, topic, speaking_tasks(id)"),
        supabase.from("speaking_attempts").select("task_id"),
        supabase.from("tests").select("id, subject, title, test_date").gte("test_date", t).lte("test_date", addDays(3)).order("test_date"),
        supabase.from("flashcard_sets").select("id, topic, flashcards(id)"),
        supabase.from("flashcard_progress").select("card_id").eq("known", true),
      ]);
      const done = new Set((subs.data ?? []).filter((x) => x.status !== "redo").map((x) => x.homework_id));
      const redo = new Set((subs.data ?? []).filter((x) => x.status === "redo").map((x) => x.homework_id));
      const pending = (hw.data ?? []).filter((h) => !done.has(h.id));
      counts.homework = pending.length;
      for (const h of pending.slice(0, 5))
        items.push({ href: "/homework", icon: redo.has(h.id) ? "🔁" : "📝", title: `${h.subject}: ${h.title}`, sub: (redo.has(h.id) ? "Ma'am asked to redo" : "Homework to do") + (h.due_date ? ` · due ${h.due_date}` : "") });

      const tried = new Set((qa.data ?? []).map((a) => a.quiz_id));
      const newQuizzes = (qz.data ?? []).filter((q) => !tried.has(q.id));
      counts.quizzes = newQuizzes.length;
      for (const q of newQuizzes) items.push({ href: `/quizzes/${q.id}`, icon: "🧠", title: `New ${q.subject} quiz`, sub: q.topic });

      const spoken = new Set((sa.data ?? []).map((a) => a.task_id));
      const newSpk = (ss.data ?? []).filter((s) => (s.speaking_tasks as { id: string }[]).some((tk) => !spoken.has(tk.id)));
      counts.speaking = newSpk.length;
      for (const s of newSpk) items.push({ href: `/speaking/${s.id}`, icon: "🎤", title: "English speaking practice", sub: s.topic || "Speak and get stars" });

      const knownIds = new Set((fp.data ?? []).map((x) => x.card_id));
      const newSets = (fs.data ?? []).filter((x) => (x.flashcards as { id: string }[]).some((c) => !knownIds.has(c.id)));
      counts.flashcards = newSets.length;
      for (const x of newSets) items.push({ href: `/flashcards/${x.id}`, icon: "🃏", title: "New word flashcards", sub: x.topic });

      counts.tests = ts.data?.length ?? 0;
      for (const x of ts.data ?? []) items.push({ href: "/tests", icon: "🏆", title: `${x.subject} test ${x.test_date === t ? "today" : "on " + x.test_date}`, sub: x.title });
    }
    setState({ items, counts });
  }, [role]);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return <Ctx.Provider value={{ ...state, refresh }}>{children}</Ctx.Provider>;
}
