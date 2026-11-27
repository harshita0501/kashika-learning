/**
 * Reading sentences aloud.
 * 1) If the server has a neural text-to-speech key (Azure Speech), use that voice (natural, fluent) - cached in storage.
 * 2) Otherwise use the best voice the device has, sentence by sentence with small pauses, at a calm pace.
 */

type V = { name: string; lang: string; localService?: boolean; default?: boolean };

/** Higher = better. Prefers neural / "natural" / enhanced voices, Indian or British English, female teacher-like voices. */
export function scoreVoice(v: V): number {
  const n = v.name.toLowerCase(), l = v.lang.toLowerCase().replace("_", "-");
  if (!l.startsWith("en")) return -1000;
  let s = 0;
  if (/natural|neural|online|enhanced|premium|siri/.test(n)) s += 60;          // Edge "Natural", Apple enhanced / Siri
  if (/google/.test(n)) s += 35;                                                // Chrome's Google voices sound decent
  if (/neerja|heera|prabhat|ananya|aditi|veena|raveena|kajal|swara/.test(n)) s += 45; // Indian English voices
  if (/ava|jenny|aria|sonia|libby|samantha|serena|karen|moira|tessa|zira|emma|olivia|nicole/.test(n)) s += 25;
  if (/female|woman/.test(n)) s += 8;
  if (l === "en-in") s += 30; else if (l === "en-gb") s += 18; else if (l === "en-us") s += 12; else if (l === "en-au") s += 6;
  if (/compact|espeak|festival|pico|novelty|whisper|bad news|bells|cellos|boing|zarvox|trinoids|organ|albert|bahh|fred|junior|kathy|ralph|superstar/.test(n)) s -= 200;
  if (/\bmale\b|daniel|alex|fred|david|mark|george|rishi/.test(n)) s -= 6;     // a gentle female voice suits a young learner
  if (v.localService === false) s += 4;
  return s;
}
export function pickVoice<T extends V>(voices: T[]): T | null {
  const ranked = voices.map((v) => [scoreVoice(v), v] as const).filter(([s]) => s > -100).sort((a, b) => b[0] - a[0]);
  return ranked[0]?.[1] ?? null;
}

/** "I like mangoes. Do you?" -> ["I like mangoes.", "Do you?"] */
export function sentences(text: string): string[] {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?।]+[.!?।]*/g);
  return (parts ?? [text]).map((p) => p.trim()).filter(Boolean);
}

let current: HTMLAudioElement | null = null;
let neuralOff = false; // set when the server has no neural voice, so we stop asking
const urlCache = new Map<string, string>();

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  if (current) { current.pause(); current = null; }
}

async function getVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const list = synth.getVoices();
  if (list.length) return list;
  await new Promise<void>((resolve) => { const t = setTimeout(resolve, 800); synth.addEventListener("voiceschanged", () => { clearTimeout(t); resolve(); }, { once: true }); });
  return synth.getVoices();
}

async function speakWithDeviceVoice(text: string, rate: number) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const voice = pickVoice(await getVoices());
  for (const part of sentences(text)) {
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(part);
      if (voice) { u.voice = voice as SpeechSynthesisVoice; u.lang = voice.lang; } else u.lang = "en-IN";
      u.rate = rate; u.pitch = 1.02; u.volume = 1;
      u.onend = () => setTimeout(resolve, 220);      // a small breath between sentences
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }
}

/** The neural voice from the server (null when it is not set up or fails). */
async function neuralUrl(text: string): Promise<string | null> {
  if (neuralOff) return null;
  if (urlCache.has(text)) return urlCache.get(text)!;
  try {
    const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (res.status === 501) { neuralOff = true; return null; }
    if (!res.ok) return null;
    const { url } = await res.json();
    if (url) urlCache.set(text, url);
    return url ?? null;
  } catch { return null; }
}

/** Warm the cache so the first tap on "Listen" is instant. */
export function prefetchSpeech(texts: string[]) { texts.slice(0, 12).forEach((t) => { void neuralUrl(t); }); }

export async function speak(text: string, opts: { rate?: number } = {}) {
  if (typeof window === "undefined" || !text.trim()) return;
  stopSpeaking();
  const url = await neuralUrl(text.trim());
  if (url) {
    const a = new Audio(url); current = a;
    try { await a.play(); return; } catch { /* autoplay blocked or bad file: fall back */ }
  }
  await speakWithDeviceVoice(text, opts.rate ?? 0.9);
}
