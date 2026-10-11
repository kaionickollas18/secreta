import type { Member, School } from "../types/directory";
import { normalizeText } from "./tasks";

const byName = (a: { fullName: string }, b: { fullName: string }) =>
  a.fullName.localeCompare(b.fullName, "pt-BR");

export function sortSchools(schools: School[]): School[] {
  return [...schools].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function secretaryOf(schoolId: string, members: Member[]): Member | undefined {
  return members.find((m) => m.schoolId === schoolId && m.role === "secretary");
}

export function assistantsOf(members: Member[], schoolId?: string | null): Member[] {
  return members
    .filter((m) => m.role === "assistant" && (schoolId === undefined || m.schoolId === schoolId))
    .sort(byName);
}

/** Busca sem acento e sem diferenciar maiúsculas em nome e e-mail. */
export function filterMembers(members: Member[], query: string): Member[] {
  const needle = normalizeText(query.trim());
  if (!needle) return members;
  return members.filter((m) => normalizeText(`${m.fullName} ${m.email}`).includes(needle));
}
