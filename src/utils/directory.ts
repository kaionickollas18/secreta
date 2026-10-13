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

/** Nome curto para listas: o apelido, se houver; senão, o nome completo. */
export function displayName(member: Pick<Member, "fullName" | "nickname">): string {
  return member.nickname || member.fullName;
}

/** Secretário e auxiliares de uma escola: o secretário primeiro, depois os ativos, por nome. */
export function schoolTeam(members: Member[], schoolId: string): Member[] {
  const rank = (m: Member) => (m.role === "secretary" ? 0 : m.active ? 1 : 2);
  return members
    .filter((m) => m.schoolId === schoolId && (m.role === "secretary" || m.role === "assistant"))
    .sort((a, b) => rank(a) - rank(b) || byName(a, b));
}

/** Idade em anos completos em `today` (datas YYYY-MM-DD). */
export function ageOn(birthDate: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}

/** Busca sem acento e sem diferenciar maiúsculas em nome e e-mail. */
export function filterMembers(members: Member[], query: string): Member[] {
  const needle = normalizeText(query.trim());
  if (!needle) return members;
  return members.filter((m) => normalizeText(`${m.fullName} ${m.email}`).includes(needle));
}
