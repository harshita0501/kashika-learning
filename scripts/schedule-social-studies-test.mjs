// One-off: schedule tomorrow's SST test and upload the question-paper photos (hidden from Kashika until the test time).
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
const { SUPABASE_URL, SUPABASE_ANON_KEY, MAAM_EMAIL, MAAM_PASSWORD, FILES, TEST_DATE, TEST_TIME } = process.env;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { error: ae } = await sb.auth.signInWithPassword({ email: MAAM_EMAIL, password: MAAM_PASSWORD });
if (ae) throw ae;
const type = (f) => (f.endsWith(".webp") ? "image/webp" : f.endsWith(".png") ? "image/png" : "image/jpeg");
const paths = [];
for (const f of FILES.split(",")) {
  const bytes = await readFile(f);
  const remote = `tests/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${path.basename(f).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await sb.storage.from("uploads").upload(remote, bytes, { contentType: type(f) });
  if (error) throw error;
  paths.push(remote);
}
const { data: test, error: te } = await sb.from("tests").insert({
  subject: "Social Studies", title: "Social Studies Test: Story of Fire, Farming and the Wheel", test_date: TEST_DATE, test_time: TEST_TIME,
  syllabus: "The Story of Fire, Farming and the Wheel (Social Studies, pages 224-226)", paper_ready: true,
}).select("id").single();
if (te) throw te;
const { error: pe } = await sb.from("test_papers").insert({ test_id: test.id, file_paths: paths, note: "Do it in your notebook, then upload photos of your answer sheet." });
if (pe) throw pe;
console.log("scheduled test", test.id, "with", paths.length, "paper photos");
