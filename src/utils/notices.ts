import type { Reminder, ReminderStatus } from "../types/reminder";
import type { Task } from "../types/task";
import { todayISO } from "./date";
import { reminderStatus, sortByUrgency } from "./reminders";

/** Horas em que o aviso de lembretes aparece (e reaparece, se foi dispensado). */
export const NOTICE_HOURS = [8, 12] as const;

/** Onde o navegador guarda o último aviso de lembretes dispensado. */
export const NOTICE_DISMISS_KEY = "secreta:avisos";

/**
 * Aviso de lembretes em vigor agora: `null` antes das 8h; depois, a hora do último aviso
 * (8 ou 12) e uma chave que muda a cada aviso, para saber se este já foi dispensado.
 */
export function noticeSlot(now: Date): { hour: number; key: string } | null {
  const hour = [...NOTICE_HOURS].reverse().find((h) => now.getHours() >= h);
  return hour === undefined ? null : { hour, key: `${todayISO(now)}|${hour}` };
}

/** Lembretes que pedem ação hoje (no prazo ou atrasados), o mais urgente primeiro. */
export function reminderNotices(
  reminders: Reminder[],
  doneKeys: ReadonlySet<string>,
  today: string = todayISO(),
): { reminder: Reminder; status: ReminderStatus }[] {
  return sortByUrgency(
    reminders
      .map((reminder) => ({ reminder, status: reminderStatus(reminder, doneKeys, today) }))
      .filter(({ status }) => status.state === "active" || status.state === "overdue"),
  );
}

/** Tarefas não concluídas em que a pessoa é responsável e que vencem hoje ou já venceram. */
export function myDueTasks(
  tasks: Task[],
  userId: string,
  today: string = todayISO(),
): { dueToday: Task[]; overdue: Task[] } {
  const mine = tasks.filter(
    (t) => t.status !== "done" && t.dueDate !== undefined && t.dueDate !== "" && t.assignees.includes(userId),
  );
  return {
    dueToday: mine.filter((t) => t.dueDate === today),
    overdue: mine.filter((t) => (t.dueDate ?? "") < today),
  };
}

/** "A, B e mais 2": os primeiros títulos e quantos ficaram de fora. */
export function summarizeTitles(titles: string[], max = 2): string {
  const shown = titles.slice(0, max).join(", ");
  const rest = titles.length - max;
  return rest > 0 ? `${shown} e mais ${rest}` : shown;
}

export function readDismissedNotice(): string | null {
  try {
    return window.localStorage.getItem(NOTICE_DISMISS_KEY);
  } catch {
    return null;
  }
}

export function writeDismissedNotice(key: string): void {
  try {
    window.localStorage.setItem(NOTICE_DISMISS_KEY, key);
  } catch {
    // Sem armazenamento (navegação privada): o aviso só volta ao recarregar a página.
  }
}
