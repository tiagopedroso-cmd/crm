"use client";
import { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { referenceData } from "@/services/crm";
import type { Profile } from "@/types/crm";
export const ProfileContext = createContext<Profile | null>(null);
export function useProfile() {
  const p = useContext(ProfileContext);
  if (!p) throw new Error("Perfil indisponível");
  return p;
}
export function useReference() {
  const p = useProfile();
  return useQuery({
    queryKey: ["reference", p.id],
    queryFn: () => referenceData(p.id),
  });
}
export function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}
