import type { Occurrence, Reminder } from "./reminder";
import type { Task } from "./task";

/** O que um evento do calendário é. `holiday` cobre feriados e pontos facultativos. */
export const EVENT_KINDS = [
  "holiday",
  "recess",
  "planning",
  "meeting",
  "training",
  "council",
  "semec",
  "grades",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** `national` e `optional` são calculados; `school` vem do cadastro da escola. */
export type HolidaySource = "national" | "optional" | "school";

/**
 * Evento do calendário: feriado, recesso ou outro evento da escola (ver `kind`). O nome
 * "Holiday" vem da primeira versão, só com feriados, e da tabela `holidays`. Datas em
 * YYYY-MM-DD; um dia só tem `start === end`.
 */
export interface Holiday {
  id: string;
  name: string;
  start: string;
  end: string;
  source: HolidaySource;
  kind: EventKind;
}

export interface HolidayInput {
  kind: EventKind;
  name: string;
  start: string;
  end: string;
}

/** Valores crus do formulário (sempre strings). */
export interface HolidayFormValues {
  kind: EventKind;
  /** Em branco, vale o nome do tipo (menos para feriado, que precisa de nome). */
  name: string;
  start: string;
  end: string;
}

export type HolidayFormErrors = Partial<Record<keyof HolidayFormValues, string>>;

/** Lembrete em um dia do calendário, com o ciclo a que pertence. */
export interface DayReminder {
  reminder: Reminder;
  occurrence: Occurrence;
  done: boolean;
}

/** Tudo o que cai em um dia. */
export interface DayEvents {
  holidays: Holiday[];
  tasks: Task[];
  reminders: DayReminder[];
}
