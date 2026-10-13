import type { Occurrence, Reminder } from "./reminder";
import type { Task } from "./task";

/** `national` e `optional` são calculados; `school` vem do cadastro da escola. */
export type HolidaySource = "national" | "optional" | "school";

/** Feriado, ponto facultativo ou recesso. Datas em YYYY-MM-DD; um dia só tem `start === end`. */
export interface Holiday {
  id: string;
  name: string;
  start: string;
  end: string;
  source: HolidaySource;
}

export interface HolidayInput {
  name: string;
  start: string;
  end: string;
}

/** Valores crus do formulário (sempre strings). */
export interface HolidayFormValues {
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
