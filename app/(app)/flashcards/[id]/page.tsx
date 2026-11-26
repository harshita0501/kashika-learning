"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { Confetti, ErrorBox, Ring } from "@/components/ui";
import { useTodo } from "@/lib/todo";

type Card = { id: string; position: number; word: string; emoji: string; meaning: string; example: string; hindi: string };
type SetRow = { id: string; topic: string; status: "draft" | "assigned" };

function say(text: string) {
  try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "en-IN"; u.rate = 0.8; window.speechSynthesis.speak(u); } catch { /* unsupported */ }
}
const HUES = ["from-fuchsia-500 to-pink-500", "from-amber-400 to-orange-500", "from-teal-400 to-emerald-500", "from-indigo-500 to-violet-500", "from-sky-400 to-blue-500"];

export default function Deck() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const todo = useTodo();
  const [set, setSet] = useState<SetRow | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const [queue, setQueue] = useState<string[]>([]); // card ids still to go this round
  const [flipped, setFlipped] = useState(false);
  const [round, setRound] = useState<"play" | "done">("play");
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      supabase.from("flashcard_sets").select("*").eq("id", id).maybeSingle(),
      supabase.from("flashcards").select("*").eq("set_id", id).order("position"),
    ]);
    const cs = (c.data ?? []) as Card[];
    const p = cs.length ? await supabase.from("flashcard_progress").select("card_id, known").in("card_id", cs.map((x) => x.id)) : { data: [] };
    setSet(s.data as SetRow | null); setCards(cs);
    setKnown(Object.fromEntries((p.data ?? []).map((x) => [x.card_id, x.known])));
    setLoaded(true);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!loaded) return <div className="text-center py-16 text-5xl float">🦉</div>;
  if (!set) return <p>Not found.</p>;

  const isTeacher = me.role === "teacher";
  const isStudent = me.role === "student";
  const knownCount = cards.filter((c) => known[c.id]).length;
  const cur = cards.find((c) => c.id === queue[0]);

  function start(ids: string[]) { setQueue(ids); setFlipped(false); setRound("play"); setStarted(true); }
  async function answer(card: Card, ok: boolean) {
    setKnown((k) => ({ ...k, [card.id]: ok }));
    const { data: prev } = await supabase.from("flashcard_progress").select("seen_count").eq("card_id", card.id).maybeSingle();
    await supabase.from("flashcard_progress").upsert({ card_id: card.id, known: ok, seen_count: (prev?.seen_count ?? 0) + 1, updated_at: new Date().toISOString() });
    setFlipped(false);
    setTimeout(() => {
      const rest = queue.slice(1);
      if (!ok) rest.push(card.id); // missed cards come back at the end
      setQueue(rest);
      if (rest.length === 0) { setRound("done"); todo.refresh(); }
    }, 250);
  }
  async function setStatus(status: "draft" | "assigned") { await supabase.from("flashcard_sets").update({ status }).eq("id", id); load(); todo.refresh(); }
  async function delSet() { if (!confirm("Delete this whole flashcard set?")) return; await supabase.from("flashcard_sets").delete().eq("id", id); todo.refresh(); router.push("/flashcards"); }
  async function removeCard(c: Card) { await supabase.from("flashcards").delete().eq("id", c.id); load(); }
  async function replaceCard(c: Card) {
    setBusy(c.id); setErr("");
    const r = await fetch("/api/flashcards/replace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ card_id: c.id }) });
    if (!r.ok) setErr((await r.json()).error || "Could not replace");
    setBusy(null); load();
  }

  const head = (
    <div className="space-y-2 fade-up">
      <button onClick={() => router.push("/flashcards")} className="text-sm font-extrabold text-violet-600">‹ All flashcards</button>
      <div className="rounded-[1.75rem] p-4 text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 shadow-lg flex items-center gap-3">
        <span className="size-12 rounded-2xl bg-white/25 grid place-items-center text-2xl">🃏</span>
        <div className="flex-1"><div className="text-white/85 text-xs font-extrabold uppercase tracking-wide">Word flashcards</div><h1 className="text-2xl font-extrabold leading-tight">{set.topic}</h1></div>
        <div className="text-right text-sm font-extrabold">{knownCount}/{cards.length}<div className="text-[11px] text-white/80">known</div></div>
      </div>
    </div>
  );

  // ----- Ma'am / parent: browse the deck -----
  if (!isStudent) {
    return (
      <div className="space-y-3">
        {head}
        {isTeacher && (
          <div className="card p-3 flex flex-wrap items-center gap-2 fade-up">
            <span className={`chip ${set.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{set.status === "draft" ? "Draft" : "Assigned to Kashika"}</span>
            {set.status === "draft"
              ? <button onClick={() => setStatus("assigned")} disabled={!cards.length} className="btn btn-green !py-2">✔ Assign to Kashika</button>
              : <button onClick={() => setStatus("draft")} className="btn btn-ghost !py-2">Take back to draft</button>}
            <button onClick={delSet} className="text-rose-600 text-sm font-bold ml-auto">Delete</button>
          </div>
        )}
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="grid sm:grid-cols-2 gap-3">
          {cards.map((c, i) => (
            <article key={c.id} className="card overflow-hidden fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className={`px-4 py-3 text-white bg-gradient-to-r ${HUES[i % HUES.length]} flex items-center gap-2`}>
                <span className="text-3xl">{c.emoji || "🔤"}</span><span className="font-display font-extrabold text-2xl flex-1">{c.word}</span>
                {known[c.id] && <span className="chip bg-white/25">✅ known</span>}
              </div>
              <div className="p-3 text-sm space-y-0.5">
                <p><b>Meaning:</b> {c.meaning}</p>
                {c.hindi && <p><b>हिंदी:</b> {c.hindi}</p>}
                {c.example && <p className="text-slate-600">“{c.example}”</p>}
                {isTeacher && set.status === "draft" && (
                  <div className="flex gap-4 pt-1">
                    <button disabled={busy === c.id} onClick={() => replaceCard(c)} className="text-violet-600 font-extrabold disabled:opacity-40">🔄 Replace</button>
                    <button disabled={busy === c.id} onClick={() => removeCard(c)} className="text-rose-600 font-extrabold disabled:opacity-40">🗑 Remove</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  // ----- Kashika: study mode -----
  if (!started) {
    return (
      <div className="space-y-3">
        {head}
        <div className="card p-6 text-center space-y-3 pop">
          <Ring value={knownCount} max={cards.length} size={120} from="#e879f9" to="#ec4899"><div><div className="font-display font-extrabold text-3xl leading-none">{knownCount}/{cards.length}</div><div className="text-[11px] font-bold text-slate-500">words known</div></div></Ring>
          <p className="text-slate-600 font-semibold">Flip each card, read the meaning, then tell us if you know it!</p>
          <button onClick={() => start(cards.map((c) => c.id))} disabled={!cards.length} className="btn btn-primary btn-big">{knownCount ? "🔁 Study all words again" : "🚀 Start learning"}</button>
          {knownCount > 0 && knownCount < cards.length && <button onClick={() => start(cards.filter((c) => !known[c.id]).map((c) => c.id))} className="btn btn-soft btn-big">💪 Practise the {cards.length - knownCount} I don&apos;t know</button>}
        </div>
      </div>
    );
  }

  if (round === "done" || !cur) {
    const all = knownCount === cards.length;
    return (
      <div className="space-y-3">
        {all && <Confetti />}
        {head}
        <div className="card p-6 text-center space-y-3 pop">
          <div className="text-6xl">{all ? "🏆" : "🌟"}</div>
          <h2 className="font-display font-extrabold text-2xl">{all ? "You know all the words!" : "Great practice!"}</h2>
          <p className="text-slate-600 font-semibold">{knownCount} of {cards.length} words known.</p>
          {!all && <button onClick={() => start(cards.filter((c) => !known[c.id]).map((c) => c.id))} className="btn btn-primary btn-big">💪 Practise the rest</button>}
          <button onClick={() => setStarted(false)} className="btn btn-soft btn-big">Done</button>
        </div>
      </div>
    );
  }

  const hue = HUES[cards.indexOf(cur) % HUES.length];
  const total = cards.length;
  return (
    <div className="space-y-3">
      {head}
      <div className="fade-up">
        <div className="flex justify-between text-sm font-extrabold mb-1"><span>{queue.length} card{queue.length > 1 ? "s" : ""} to go</span><span>✅ {knownCount}</span></div>
        <div className="h-3 rounded-full bg-white border border-violet-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all duration-500" style={{ width: `${(knownCount / total) * 100}%` }} /></div>
      </div>

      <div className="flip-scene pop" key={cur.id}>
        <div role="button" tabIndex={0} onClick={() => setFlipped((f) => !f)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); } }}
          className={`flip-card h-[26rem] cursor-pointer select-none ${flipped ? "flipped" : ""}`}>
          {/* front */}
          <div className={`flip-face rounded-[2rem] bg-gradient-to-br ${hue} text-white shadow-2xl shadow-fuchsia-300/50 grid place-items-center p-6 text-center`}>
            <div>
              <div className="text-8xl float">{cur.emoji || "🔤"}</div>
              <div className="font-display font-extrabold text-5xl mt-3 break-words">{cur.word}</div>
              <button onClick={(e) => { e.stopPropagation(); say(cur.word); }} className="mt-4 btn bg-white/25 text-white !shadow-none">🔊 Listen</button>
              <div className="mt-5 text-white/80 font-extrabold text-sm animate-pulse">👆 Tap to see the meaning</div>
            </div>
          </div>
          {/* back */}
          <div className="flip-face flip-back rounded-[2rem] bg-white border-4 border-fuchsia-200 shadow-2xl shadow-fuchsia-200/60 p-6 flex flex-col justify-center text-center gap-3">
            <div className="font-display font-extrabold text-3xl text-fuchsia-600">{cur.emoji} {cur.word}</div>
            <p className="text-xl font-bold leading-snug">{cur.meaning}</p>
            {cur.hindi && <p className="text-2xl font-extrabold text-violet-700">{cur.hindi}</p>}
            {cur.example && (
              <button onClick={(e) => { e.stopPropagation(); say(cur.example); }} className="mx-auto rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2 text-slate-700 font-semibold text-left">
                🔊 “{cur.example}”
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button disabled={!flipped} onClick={() => answer(cur, false)} className="btn btn-red btn-big">🔁 Practise again</button>
        <button disabled={!flipped} onClick={() => answer(cur, true)} className="btn btn-green btn-big">✅ I know it!</button>
      </div>
      {!flipped && <p className="text-center text-sm text-slate-500 font-semibold">Flip the card first 👆</p>}
    </div>
  );
}
