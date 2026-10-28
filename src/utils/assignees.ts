import type { Member } from "../types/directory";

/** Classes completas (o Tailwind precisa vê-las inteiras no código). */
const COLORS = [
  { badge: "bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-200 border-fuchsia-400/50", avatar: "bg-fuchsia-500 text-white", text: "text-fuchsia-700 dark:text-fuchsia-200" },
  { badge: "bg-sky-500/20 text-sky-700 dark:text-sky-200 border-sky-400/50", avatar: "bg-sky-500 text-white", text: "text-sky-700 dark:text-sky-200" },
  { badge: "bg-violet-500/20 text-violet-700 dark:text-violet-200 border-violet-400/50", avatar: "bg-violet-500 text-white", text: "text-violet-700 dark:text-violet-200" },
  { badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border-emerald-400/50", avatar: "bg-emerald-500 text-white", text: "text-emerald-700 dark:text-emerald-200" },
  { badge: "bg-amber-500/20 text-amber-700 dark:text-amber-200 border-amber-400/50", avatar: "bg-amber-500 text-white", text: "text-amber-700 dark:text-amber-200" },
  { badge: "bg-rose-500/20 text-rose-700 dark:text-rose-200 border-rose-400/50", avatar: "bg-rose-500 text-white", text: "text-rose-700 dark:text-rose-200" },
] as const;

/** Cor estável por pessoa: o mesmo id sempre recebe a mesma cor. */
export function assigneeColor(id: string): (typeof COLORS)[number] {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length] as (typeof COLORS)[number];
}

/**
 * Quem pode ser responsável por tarefas: o Secretário (primeiro) e os Assistentes ativos,
 * em ordem alfabética de sobrenome.
 */
export function assignableMembers(members: Member[]): Member[] {
  return members
    .filter((m) => m.active && (m.role === "secretary" || m.role === "assistant"))
    .sort(
      (a, b) =>
        Number(b.role === "secretary") - Number(a.role === "secretary") ||
        a.lastName.localeCompare(b.lastName, "pt-BR"),
    );
}

/** Mapa id → pessoa, para achar o sobrenome de um responsável. */
export function membersById(members: Member[]): Map<string, Member> {
  return new Map(members.map((m) => [m.id, m]));
}
