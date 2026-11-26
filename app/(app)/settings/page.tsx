"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";

export default function Settings() {
  const me = useMe();
  const [zoom, setZoom] = useState("");
  const [time, setTime] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("settings").select("zoom_link, class_time").eq("id", 1).single().then(({ data }) => {
      setZoom(data?.zoom_link ?? ""); setTime(data?.class_time ?? "");
    });
  }, []);

  if (me.role !== "teacher") return <p>Only ma&apos;am can change settings.</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("settings").update({ zoom_link: zoom.trim(), class_time: time.trim() }).eq("id", 1);
    setMsg(error ? error.message : "Saved ✓");
  }

  return (
    <form onSubmit={save} className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
      <h1 className="text-2xl font-bold">⚙️ Settings</h1>
      <label className="block text-sm font-medium">Zoom meeting link
        <input value={zoom} onChange={(e) => setZoom(e.target.value)} type="url" placeholder="https://zoom.us/j/..." className="w-full border rounded-xl px-3 py-2 mt-1" />
      </label>
      <label className="block text-sm font-medium">Class time (shown on Join button)
        <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 4:00 PM – 5:30 PM, Mon–Sat" className="w-full border rounded-xl px-3 py-2 mt-1" />
      </label>
      <button className="bg-indigo-600 text-white rounded-xl px-5 py-2 font-semibold">Save</button>
      {msg && <p className="text-sm text-green-700">{msg}</p>}
    </form>
  );
}
