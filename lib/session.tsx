"use client";
import { createContext, useContext } from "react";
import type { Role } from "./constants";

export type Me = { id: string; name: string; role: Role };
const Ctx = createContext<Me | null>(null);
export const SessionProvider = Ctx.Provider;
export function useMe() {
  const me = useContext(Ctx);
  if (!me) throw new Error("useMe outside provider");
  return me;
}
