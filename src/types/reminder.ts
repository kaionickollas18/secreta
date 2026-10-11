export const REMINDER_KINDS = ["monthly", "weekly", "once"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Quando o lembrete se repete. Datas em YYYY-MM-DD; meses em YYYY-MM. */
export type Schedule =
  | { kind: "once"; dueDate: string }
  /** 0 = domingo … 6 = sábado. */
  | { kind: "weekly"; weekday: number }
  /** A cada `intervalMonths` meses a partir de `startMonth`, do dia `dayStart` ao `dayEnd`. */
  | { kind: "monthly"; intervalMonths: number; startMonth: string; dayStart: number; dayEnd: number };

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  schedule: Schedule;
  /** Dia da criação (YYYY-MM-DD). Ciclos anteriores a ele não contam como atrasados. */
  createdOn: string;
}

export interface ReminderInput {
  title: string;
  notes?: string;
  schedule: Schedule;
}

/** Valores crus do formulário (sempre strings). */
export interface ReminderFormValues {
  title: string;
  notes: string;
  kind: ReminderKind;
  dueDate: string;
  weekday: string;
  intervalMonths: string;
  startMonth: string;
  dayStart: string;
  dayEnd: string;
}

export type ReminderFormErrors = Partial<Record<keyof ReminderFormValues, string>>;

/** Um ciclo do lembrete: o período em que ele deve ser cumprido. */
export interface Occurrence {
  /** Identifica o ciclo ao marcar como feito (ex.: "2026-10", "2026-10-12", "once"). */
  periodKey: string;
  start: string;
  end: string;
}

export type ReminderState = "overdue" | "active" | "upcoming" | "done" | "finished";

export interface ReminderStatus {
  state: ReminderState;
  /** Ciclo a que o estado se refere (o próximo, quando `upcoming`). `null` quando encerrado. */
  occurrence: Occurrence | null;
  /** Ciclo seguinte ao atual, se houver. */
  next: Occurrence | null;
  /** overdue: dias de atraso · active: dias restantes · upcoming: dias até começar. */
  days: number;
}
