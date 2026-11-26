import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export const BUCKET = "uploads";

/** Big phone photos are shrunk (max 1800px, JPEG) so uploads are fast and the AI can read many pages at once. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 400_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

export async function uploadFile(input: File, folder: string) {
  const file = await shrinkImage(input);
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

export async function fileUrl(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

/** Current date and time in India (the paper opens by India time, whatever the device clock says). */
export function istNow() {
  const s = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }); // "2026-11-26 23:36:46"
  return { date: s.slice(0, 10), time: s.slice(11, 16), stamp: s.slice(0, 16) };
}
/** "16:00:00" -> "4:00 PM" */
export function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
/** Minutes from now (India time) until date+time; negative when already past. */
export function minutesUntil(date: string, time: string | null | undefined) {
  const target = new Date(`${date}T${(time || "00:00").slice(0, 5)}:00+05:30`).getTime();
  return Math.round((target - Date.now()) / 60000);
}
export function fmtCountdown(mins: number) {
  if (mins <= 0) return "now";
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m} min`;
}
