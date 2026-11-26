"use client";
import { useEffect, useRef, useState } from "react";

type Rec = { start(): void; stop(): void; abort(): void; lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null };
type RecCtor = new () => Rec;

export type Recorded = { blob: Blob; mime: string; transcript: string };

/** Big mic button. Records audio (MediaRecorder) and, where the browser supports it, live-transcribes it (Web Speech API). */
export default function VoiceRecorder({ onReady, disabled }: { onReady: (r: Recorded | null) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [heard, setHeard] = useState("");
  const [err, setErr] = useState("");
  const [secs, setSecs] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const sr = useRef<Rec | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const finalText = useRef("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const W = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    setSupported(!!(W.SpeechRecognition || W.webkitSpeechRecognition));
  }, []);

  useEffect(() => () => { // cleanup on unmount
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    sr.current?.abort();
  }, []);

  async function start() {
    setErr(""); setHeard(""); finalText.current = ""; chunks.current = []; setSecs(0);
    if (url) { URL.revokeObjectURL(url); setUrl(null); }
    onReady(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErr("Please allow the microphone, then try again."); return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    mr.current = rec;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    rec.onstop = () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
      setUrl(URL.createObjectURL(blob));
      setState("done");
      // give the recogniser a moment to deliver its last words
      setTimeout(() => onReady({ blob, mime: blob.type, transcript: finalText.current.trim() }), 700);
    };
    rec.start();

    const W = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (Ctor) {
      try {
        const r = new Ctor();
        r.lang = "en-IN"; r.continuous = true; r.interimResults = true;
        r.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            if (res.isFinal) finalText.current += " " + res[0].transcript; else interim += res[0].transcript;
          }
          setHeard((finalText.current + " " + interim).trim());
        };
        r.onerror = () => {};
        r.onend = () => { setHeard(finalText.current.trim()); };
        r.start();
        sr.current = r;
      } catch { /* transcription is optional */ }
    }
    setState("recording");
    timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    try { sr.current?.stop(); } catch { /* ignore */ }
    if (mr.current && mr.current.state !== "inactive") mr.current.stop();
  }

  return (
    <div className="space-y-2">
      {state !== "recording" ? (
        <button type="button" onClick={start} disabled={disabled}
          className="w-full bg-red-500 text-white rounded-2xl py-4 text-lg font-bold flex items-center justify-center gap-2 active:scale-[.98] transition disabled:opacity-50">
          🎤 {state === "done" ? "Record again" : "Tap to speak"}
        </button>
      ) : (
        <button type="button" onClick={stop}
          className="w-full bg-gray-900 text-white rounded-2xl py-4 text-lg font-bold flex items-center justify-center gap-2 animate-pulse">
          ⏹ Stop &nbsp;<span className="font-mono">0:{String(secs).padStart(2, "0")}</span>
        </button>
      )}
      {state === "recording" && <p className="text-center text-sm text-red-600">● Recording… speak clearly</p>}
      {heard && <p className="bg-yellow-50 rounded-xl px-3 py-2 text-sm"><b>I heard:</b> {heard}</p>}
      {url && <audio controls src={url} className="w-full" />}
      {state === "done" && !supported && <p className="text-xs text-gray-500">This browser can&apos;t write down your words. Ma&apos;am will listen to your recording and give marks. (Chrome or Safari can do both.)</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
