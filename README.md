# Kashika Learning

A small school platform for Kashika (Class 3): attendance calendar, fixed Zoom class link, homework upload/check, and test schedule + marks. Roles: **student** (Kashika), **teacher** (ma'am), **parent** (view only).

Stack: Next.js + Supabase (login, database, file storage), hosted on Vercel. All free tier.

## Setup

1. **Supabase** (supabase.com) → New project. Then:
   - SQL Editor → paste and run `supabase/schema.sql`.
   - Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
   - Authentication → Users → Add user ×3 (ma'am, Kashika, parent) with email + password (tick auto-confirm).
   - SQL Editor → run the 3 `update public.profiles set role=...` lines at the bottom of `schema.sql` with the real emails.
   - Project Settings → API → copy the Project URL and the anon/publishable key.
2. **Local**: `cp .env.example .env.local`, fill both values, `npm install`, `npm run dev`.
3. **Vercel** (vercel.com) → import this repo → add the same two env vars → Deploy.

## V2 — Weekly AI quiz
Ma'am types one topic per subject → Claude drafts an 8-question quiz per subject (MCQ / fill-in-the-blank / match, chosen per question; Hindi quiz in Hindi) → ma'am reviews (remove / replace a question) → **Assign** → Kashika attempts it and gets her score.

Setup: run `supabase/v2_quizzes.sql` in the Supabase SQL editor, and add `ANTHROPIC_API_KEY` (from console.anthropic.com) to `.env.local` and to the Vercel project's environment variables, then redeploy.

Note: answer keys of *assigned* quizzes are readable by the student's browser (fine for a home practice app).

## V3 — English speaking (voice notes)
Ma'am gives an optional topic → Claude drafts 4 speaking tasks (repeat-after-me, answer, describe) → ma'am reviews and assigns → Kashika records a voice note per task (mic button; `🔊 Listen` reads repeat-sentences aloud) → the browser transcribes it (Web Speech API, works in Chrome/Safari; no extra key) → Claude gives 0-5 stars + a kind tip → ma'am can listen to the recording and override the marks.

Setup: run `supabase/v3_speaking.sql` (also adds multi-photo uploads). No new env vars.

Limits: the transcript comes from browser speech recognition, so scores are an AI *estimate* of content/grammar/word match, not a true pronunciation grader; ma'am's marks always win. If a browser can't transcribe, the recording is still saved and ma'am marks it.

## UI refresh + history + flashcards
Playful redesign (mascot, gradients, animations, confetti), streak / stars / levels / badges on Home, one-question-at-a-time quizzes with instant feedback, and a **My Work** page that keeps every old homework answer (photos), quiz attempt (with each answer), speaking recording and test (with marks + checked paper photo), filterable by month and subject.
Weekly **flashcards**: ma'am gives a theme (optional) → AI makes 10 words (front: English word; back: simple meaning, Hindi hint, example sentence) → review → assign → Kashika flips, listens (🔊) and marks "I know it" / "Practise again". Run `supabase/v4_test_papers.sql` and `supabase/v5_flashcards.sql`.

## Books + photo sources + profile
**Books** tab: the four official NCERT Class 3 books (Santoor, Maths Mela, Veena, Our Wondrous World; free for educational use, reprint 2026-27) are loaded chapter-wise; ma'am can add her own school books by uploading chapter PDFs/photos. Kashika can read them in-app. On any chapter ma'am taps 🧠 Quiz / 🃏 Cards / 🎤 Speak and the AI reads that chapter's pages and builds the set from it. The quiz / flashcard / speaking forms also take a chapter or directly uploaded photos/PDF of pages. Run `supabase/v7_set_my_name.sql`, `v8_books.sql`, `v9_source_chapter.sql`, `v10_source_paths.sql`, then `scripts/seed-ncert.mjs` (needs the NCERT PDFs downloaded from ncert.nic.in).
**Profile** page: everyone can change display name, login email (confirmation link sent to the new address) and password.

## Natural voice for "Listen" (optional)
Without any setup, "Listen" uses the best voice the device has (neural/enhanced if available), sentence by sentence with small pauses. For a ChatGPT-like fluent voice, add in Vercel: `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` (Azure AI Speech, free F0 tier = 500k characters/month). Optional: `TTS_VOICE` (default `en-IN-NeerjaNeural`), `TTS_RATE` (default `-6%`). Each sentence is synthesised once and cached in storage, so cost stays tiny.

## AI model
All AI features read `QUIZ_MODEL` (default `claude-opus-5-5`). Set `QUIZ_MODEL=claude-sonnet-5-5` in Vercel to roughly halve the cost.

## Reminders
Home shows a "To do" card, a once-per-visit pop-up for Kashika, and red badges on the menu (homework, quizzes, speaking, tests due within 3 days). Ma'am sees what needs checking/reviewing.
