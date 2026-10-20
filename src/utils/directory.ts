import type { Member, School } from "../types/directory";
import { MANAGED_ROLES } from "./roles";
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

/**
 * Pessoas de uma escola (secretário, auxiliares e professores): o secretário primeiro, depois
 * a secretaria, os professores e, por último, os inativos; cada grupo por nome.
 */
export function schoolTeam(members: Member[], schoolId: string): Member[] {
  const rank = (m: Member) => (m.role === "secretary" ? 0 : !m.active ? 3 : m.role === "assistant" ? 1 : 2);
  return members
    .filter((m) => m.schoolId === schoolId && m.role !== "master")
    .sort((a, b) => rank(a) - rank(b) || byName(a, b));
}

/** Quem o secretário cadastra e edita na Equipe: auxiliares e professores, por nome. */
export function managedMembers(members: Member[]): Member[] {
  return members.filter((m) => MANAGED_ROLES.some((r) => r === m.role)).sort(byName);
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
