"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { PageTitle } from "@/components/ui";

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
    <div className="space-y-4">
      <PageTitle emoji="⚙️" title="Settings" sub="Zoom link and class time" />
      <form onSubmit={save} className="card p-5 space-y-3 fade-up">
        <label className="block text-sm font-extrabold">Zoom meeting link
          <input value={zoom} onChange={(e) => setZoom(e.target.value)} type="url" placeholder="https://zoom.us/j/..." className="field mt-1" />
        </label>
        <label className="block text-sm font-extrabold">Class time (shown on the Join button)
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 4:00 PM – 5:30 PM, Mon–Sat" className="field mt-1" />
        </label>
        <button className="btn btn-primary btn-big">Save</button>
        {msg && <p className="text-sm font-bold text-emerald-700 pop">{msg}</p>}
      </form>
    </div>
  );
}
