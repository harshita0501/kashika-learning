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

## Roadmap
- V2: weekly auto quiz (ma'am gives topics → AI drafts → ma'am reviews → assign)
- V3: English speaking quiz with voice notes
