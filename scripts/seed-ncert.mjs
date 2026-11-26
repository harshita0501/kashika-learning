// Seeds the NCERT Class 3 books into the app (storage + books/book_chapters tables).
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... MAAM_EMAIL=... MAAM_PASSWORD=... PDF_DIR=/path/to/books node scripts/seed-ncert.mjs
// PDF_DIR holds NCERT's official chapter PDFs as <code>/<code><NN>.pdf (downloaded from https://ncert.nic.in/textbook/pdf/<code><NN>.pdf).
import { createClient } from "@supabase/supabase-js";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const { SUPABASE_URL, SUPABASE_ANON_KEY, MAAM_EMAIL, MAAM_PASSWORD, PDF_DIR } = process.env;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BOOKS = [
  { code: "cesa1", title: "Santoor", subject: "English", emoji: "🎶", description: "NCERT English textbook for Class 3 (stories, poems and activities).",
    chapters: ["Unit 1 · Fun with Friends", "2. Badal and Moti", "3. Best Friends", "Unit 2 · Toys and Games", "5. Talking Toys", "6. Paper Boats", "Unit 3 · Good Food", "8. Thank God!", "9. Madhu's Wish", "Unit 4 · The Sky", "11. Chanda Mama Counts the Stars", "12. Chandrayaan"] },
  { code: "cemm1", title: "Maths Mela", subject: "Maths", emoji: "🧮", description: "NCERT Mathematics textbook for Class 3.",
    chapters: ["1. What's in a Name?", "2. Toy Joy", "3. Double Century", "4. Vacation with My Nani Maa", "5. Fun with Shapes", "6. House of Hundreds - I", "7. Raksha Bandhan", "8. Fair Share", "9. House of Hundreds - II", "10. Fun at Class Party!", "11. Filling and Lifting", "12. Give and Take", "13. Time Goes On", "14. The Surajkund Fair"] },
  { code: "chve1", title: "Veena (वीणा)", subject: "Hindi", emoji: "🪕", description: "NCERT हिंदी पाठ्यपुस्तक, कक्षा 3।",
    chapters: ["1. सीखो", "2. चींटी", "3. कितने पैर?", "4. बया हमारी चिड़िया रानी!", "5. आम का पेड़", "6. बीरबल की खिचड़ी", "7. मित्र को पत्र", "8. चतुर गीदड़", "9. प्रकृति पर्व — फूलदेई", "10. सुनो भई गप्प", "11. एक जादुई पिटारा", "12. अपना-अपना काम", "13. पेड़ों की अम्मा 'तिमक्का'", "14. किसान की होशियारी", "15. भारत", "16. चंद्रयान (संवाद)", "17. बोलने वाली माँद", "18. हम अनेक किंतु एक"] },
  { code: "ceev1", title: "Our Wondrous World", subject: "EVS", emoji: "🌍", description: "NCERT 'The World Around Us' (EVS / science and social science) for Class 3.",
    chapters: ["Unit 1 · Our Families and Communities", "2. Going to the Mela", "3. Celebrating Festivals", "Unit 2 · Life Around Us", "5. Plants and Animals Live Together", "6. Living in Harmony", "Unit 3 · Gifts of Nature", "8. Food We Eat", "9. Staying Healthy and Happy", "Unit 4 · Things Around Us", "11. Making Things", "12. Taking Charge of Waste"] },
];

const { error: authErr } = await supabase.auth.signInWithPassword({ email: MAAM_EMAIL, password: MAAM_PASSWORD });
if (authErr) throw authErr;

async function withRetry(fn, label) {
  let last;
  for (let i = 1; i <= 4; i++) {
    try { return await fn(); } catch (e) { last = e; console.log(`  retry ${i} for ${label}: ${e.message}`); await new Promise((r) => setTimeout(r, 1500 * i)); }
  }
  throw last;
}

for (const b of BOOKS) {
  let { data: book } = await supabase.from("books").select("id").eq("title", b.title).eq("kind", "ncert").maybeSingle();
  if (!book) {
    const { data, error } = await supabase.from("books").insert({
      title: b.title, subject: b.subject, class_level: 3, publisher: "NCERT", emoji: b.emoji, description: b.description, kind: "ncert",
      source_note: "Official NCERT textbook (ncert.nic.in), reprint 2026-27. Free for educational use.",
    }).select("id").single();
    if (error) throw error;
    book = data;
  }
  const { data: have } = await supabase.from("book_chapters").select("position").eq("book_id", book.id);
  const done = new Set((have ?? []).map((x) => x.position));
  for (let i = 0; i < b.chapters.length; i++) {
    if (done.has(i)) continue;
    const n = String(i + 1).padStart(2, "0");
    const local = path.join(PDF_DIR, b.code, `${b.code}${n}.pdf`);
    const bytes = await readFile(local);
    const remote = `books/ncert/${b.code}/${b.code}${n}.pdf`;
    await withRetry(async () => {
      const { error: upErr } = await supabase.storage.from("uploads").upload(remote, bytes, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(upErr.message || "upload failed");
    }, remote);
    const { error: chErr } = await supabase.from("book_chapters").insert({ book_id: book.id, position: i, title: b.chapters[i], file_paths: [remote] });
    if (chErr) throw chErr;
    console.log(`  ${b.title} · ${b.chapters[i]}  (${((await stat(local)).size / 1e6).toFixed(1)} MB)`);
  }
}
console.log("done");
