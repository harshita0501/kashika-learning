"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type ChapterOpt = { id: string; title: string; position: number; bookTitle: string; subject: string };

/** All book chapters (for the "from a book chapter" pickers). */
export function useChapters() {
  const [list, setList] = useState<ChapterOpt[]>([]);
  useEffect(() => {
    supabase.from("book_chapters").select("id, title, position, books(title, subject)").order("position").then(({ data }) => {
      setList((data ?? []).map((c) => {
        const b = c.books as unknown as { title: string; subject: string } | null;
        return { id: c.id, title: c.title, position: c.position, bookTitle: b?.title ?? "", subject: b?.subject ?? "" };
      }));
    });
  }, []);
  return list;
}
