"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";

/** Must be called straight from a tap (browsers only allow full screen after a user action). */
export async function enterExam(): Promise<boolean> {
  try { await document.documentElement.requestFullscreen?.({ navigationUI: "hide" } as FullscreenOptions); } catch { /* not supported / denied */ }
  return !!document.fullscreenElement;
}
export async function leaveExam() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
}
export const fullscreenSupported = () => typeof document !== "undefined" && !!document.documentElement.requestFullscreen;

const LABEL: Record<string, string> = {
  exited_fullscreen: "left full screen", switched_tab: "switched to another tab or app", left_window: "left the window", pressed_back: "pressed the back button",
};
export const eventLabel = (e: string) => LABEL[e] ?? e;

/**
 * Exam mode around its children: while active, if Kashika leaves full screen, switches tab/app, or presses back,
 * the questions are hidden behind a "Test paused" screen and the event is saved for ma'am.
 * `container` = true draws a full-screen page of its own (used for the quiz); false = only the guard (used around the paper viewer).
 */
export default function ExamGuard({ kind, refId, container = true, children }: { kind: "quiz" | "test"; refId: string; container?: boolean; children: React.ReactNode }) {
  const [away, setAway] = useState(false);
  const [count, setCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const lastLog = useRef(0);
  const fs = useRef(false); // were we in full screen when the exam began?

  useEffect(() => { setMounted(true); fs.current = fullscreenSupported() && !!document.fullscreenElement; }, []);

  const log = useCallback((event: string) => {
    const now = Date.now();
    setAway(true);
    if (now - lastLog.current < 1200) return;      // one leave = one event, even if several browser signals fire together
    lastLog.current = now;
    setCount((c) => c + 1);
    // the query only runs when it is awaited / .then()-ed
    supabase.from("exam_events").insert({ ref_kind: kind, ref_id: refId, event }).then(() => {}, () => {});
  }, [kind, refId]);

  useEffect(() => {
    const onVis = () => { if (document.hidden) log("switched_tab"); };
    const onBlur = () => { setTimeout(() => { if (!document.hasFocus()) log("left_window"); }, 250); };
    const onFs = () => { if (fs.current && !document.fullscreenElement) log("exited_fullscreen"); };
    const onPop = () => { history.pushState({ exam: 1 }, ""); log("pressed_back"); };
    const onBefore = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const stop = (e: Event) => e.preventDefault();
    history.pushState({ exam: 1 }, "");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("contextmenu", stop);
    document.addEventListener("copy", stop);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onBefore);
      document.removeEventListener("contextmenu", stop);
      document.removeEventListener("copy", stop);
    };
  }, [log]);

  async function back() {
    if (fs.current) await enterExam();
    setAway(false);
  }

  if (!mounted) return null;
  return createPortal(
    <>
      {container ? <div className="fixed inset-0 z-[80] overflow-auto bg-[#f6f3ff] p-4" style={away ? { filter: "blur(22px)", pointerEvents: "none" } : undefined}><div className="mx-auto max-w-3xl">{children}</div></div>
        : <div style={away ? { filter: "blur(22px)", pointerEvents: "none" } : undefined}>{children}</div>}
      {away && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-indigo-950/80 p-6">
          <div className="card max-w-sm p-6 text-center space-y-3 pop">
            <div className="text-6xl wiggle inline-block">⚠️</div>
            <h2 className="text-2xl font-extrabold">Test paused</h2>
            <p className="text-slate-600 font-semibold">Please stay on the test screen. Ma&apos;am can see that you left ({count} time{count === 1 ? "" : "s"}).</p>
            <button onClick={back} className="btn btn-primary btn-big">↩ Back to my test</button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
