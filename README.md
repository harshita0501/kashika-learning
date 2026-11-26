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

## Reminders
Home shows a "To do" card, a once-per-visit pop-up for Kashika, and red badges on the menu (homework, quizzes, speaking, tests due within 3 days). Ma'am sees what needs checking/reviewing.
