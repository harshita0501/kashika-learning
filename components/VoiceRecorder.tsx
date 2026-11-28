"use client";
import { useEffect, useRef, useState } from "react";

type Rec = { start(): void; stop(): void; abort(): void; lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null };
type RecCtor = new () => Rec;

export type Recorded = {
  blob: Blob | null; mime: string;
  transcript: string;      // what will be scored (Kashika may have corrected it)
  original: string;        // what the browser first heard
  typed: boolean;          // typed instead of spoken
};

const MIC_HELP = {
  busy: "The microphone is busy. Another app (like Zoom) is using it. Mute or leave the Zoom class and try again - or type your answer below.",
  denied: "Please allow the microphone (tap the lock / mic icon near the web address), then try again.",
  none: "No microphone was found on this device. You can type your answer below.",
  silent: "I could not hear any sound. If you are in a Zoom class, Zoom may be holding the microphone - mute or leave Zoom, then record again. Or type your answer below.",
};

/**
 * Mic button with a live sound meter, an editable "what I heard" box (fix wrong words before sending), and a type-instead option.
 * Works with the Web Speech API for the text and MediaRecorder for the audio ma'am listens to.
 */
export default function VoiceRecorder({ onReady, disabled }: { onReady: (r: Recorded | null) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "done" | "typing">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [orig, setOrig] = useState("");   // what the browser first heard (for the "you changed it" note)
  const [err, setErr] = useState("");
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [supported, setSupported] = useState(true);
  const mr = useRef<MediaRecorder | null>(null);
  const sr = useRef<Rec | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const finalText = useRef("");
  const original = useRef("");
  const blobRef = useRef<{ blob: Blob; mime: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const peak = useRef(0);
  const srError = useRef("");

  useEffect(() => {
    const W = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    setSupported(!!(W.SpeechRecognition || W.webkitSpeechRecognition));
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      sr.current?.abort();
      void audioCtx.current?.close();
    };
  }, []);

  function stopMeter() {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null; setLevel(0);
    void audioCtx.current?.close(); audioCtx.current = null;
  }
  function startMeter(s: MediaStream) {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx(); audioCtx.current = ctx;
      const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const data = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(data);
        let m = 0; for (const v of data) m = Math.max(m, Math.abs(v - 128) / 128);
        peak.current = Math.max(peak.current, m);
        setLevel(m);
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* the meter is optional */ }
  }

  function emit(t: string, blob: Blob | null, mime: string, typed: boolean) {
    onReady(t.trim() || blob ? { blob, mime, transcript: t.trim(), original: typed ? "" : original.current, typed } : null);
  }

  async function start() {
    setErr(""); setText(""); setOrig(""); finalText.current = ""; original.current = ""; chunks.current = []; setSecs(0); peak.current = 0; srError.current = "";
    if (url) { URL.revokeObjectURL(url); setUrl(null); }
    blobRef.current = null; onReady(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const n = (e as DOMException).name;
      setErr(n === "NotReadableError" || n === "AbortError" || n === "TrackStartError" ? MIC_HELP.busy : n === "NotFoundError" ? MIC_HELP.none : MIC_HELP.denied);
      return;
    }
    startMeter(stream.current);
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    mr.current = rec;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    rec.onstop = () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      stopMeter();
      const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
      blobRef.current = { blob, mime: blob.type };
      setUrl(URL.createObjectURL(blob));
      setState("done");
      if (peak.current < 0.03) setErr(MIC_HELP.silent);
      // let the recogniser deliver its last words, then show them in the editable box
      setTimeout(() => {
        original.current = finalText.current.trim();
        setOrig(original.current);
        setText(original.current);
        emit(original.current, blob, blob.type, false);
        if (!original.current && peak.current >= 0.03) setErr(srError.current === "not-allowed" || srError.current === "audio-capture"
          ? "The app could not write down your words (the microphone may be busy). Ma'am can still listen. You can type what you said below."
          : "I could not write down your words. You can type what you said below, or record again.");
      }, 700);
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
          setText((finalText.current + " " + interim).trim());
        };
        r.onerror = (e) => { srError.current = e.error ?? ""; };
        r.onend = () => {};
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

  function startTyping() {
    setErr(""); if (url) { URL.revokeObjectURL(url); setUrl(null); }
    blobRef.current = null; setText(""); onReady(null); setState("typing");
  }
  function editText(v: string) {
    setText(v);
    if (state === "typing") emit(v, null, "", true);
    else emit(v, blobRef.current?.blob ?? null, blobRef.current?.mime ?? "", false);
  }

  const edited = state === "done" && orig.trim() !== text.trim();
  const bars = Math.round(Math.min(1, level * 3) * 12);

  return (
    <div className="space-y-2">
      {state !== "recording" ? (
        <button type="button" onClick={start} disabled={disabled} className="btn btn-red btn-big">🎤 {state === "done" ? "Record again" : "Tap to speak"}</button>
      ) : (
        <button type="button" onClick={stop} className="btn btn-big bg-slate-900 text-white animate-pulse">⏹ Stop &nbsp;<span className="font-mono">0:{String(secs).padStart(2, "0")}</span></button>
      )}

      {state === "recording" && (
        <div className="space-y-1">
          <div className="flex items-end justify-center gap-1 h-8" aria-label="sound level">
            {Array.from({ length: 12 }).map((_, i) => <span key={i} className={`w-2 rounded-full transition-all ${i < bars ? "bg-rose-500" : "bg-slate-200"}`} style={{ height: `${25 + i * 6}%` }} />)}
          </div>
          <p className="text-center text-sm font-bold text-rose-600">● Recording… {secs >= 2 && bars === 0 ? "I can't hear you yet - speak up or check the microphone" : "speak clearly"}</p>
        </div>
      )}

      {url && <audio controls src={url} className="w-full" />}

      {(state === "done" || state === "typing") && (
        <div className="space-y-1">
          <label className="block text-sm font-extrabold">{state === "typing" ? "✍️ Type what you want to say:" : "📝 What I heard (fix any wrong word before sending):"}</label>
          <textarea value={text} onChange={(e) => editText(e.target.value)} rows={3} placeholder={state === "typing" ? "Type your answer here…" : "Nothing was written down - you can type it here"}
            className={`field ${edited ? "!border-amber-400 !bg-amber-50" : ""}`} />
          <p className="text-xs text-slate-500 font-semibold">You can change this text only now. After you send, tap <b>Try again</b> to record and fix it.{edited && " ✏️ You changed it."}</p>
        </div>
      )}

      {err && <p className="text-sm font-semibold bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2.5">⚠️ {err}</p>}
      {state === "done" && !supported && <p className="text-xs text-gray-500">This browser can&apos;t write down your words. Ma&apos;am will listen to your recording. You can type the words below. (Chrome or Safari can do both.)</p>}
      {state !== "recording" && state !== "typing" && (
        <button type="button" onClick={startTyping} disabled={disabled} className="text-sm font-extrabold text-violet-600 underline">⌨️ Can&apos;t record? Type my answer instead</button>
      )}
      {state === "typing" && <button type="button" onClick={start} className="text-sm font-extrabold text-violet-600 underline">🎤 Use the microphone instead</button>}
    </div>
  );
}
