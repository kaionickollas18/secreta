import type {
  Occurrence,
  Reminder,
  ReminderFormErrors,
  ReminderFormValues,
  ReminderInput,
  ReminderState,
  ReminderStatus,
  Schedule,
} from "../types/reminder";
import { formatDueDate, isValidISODate, todayISO } from "./date";
import { sanitizeText } from "./validation";

export const REMINDER_LIMITS = { title: 120, notes: 1000 } as const;
/** Intervalos oferecidos no formulário, em meses. */
export const MONTH_INTERVALS = [1, 2, 3, 4, 6, 12] as const;
export const WEEKDAY_LABELS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

// As contas usam UTC só como calendário neutro: as datas são YYYY-MM-DD sem fuso.
function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
}

export function addDays(iso: string, days: number): string {
  return new Date(toDate(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Quantos dias `a` está depois de `b`. */
export function diffDays(a: string, b: string): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / DAY_MS);
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Mês como número corrido (ano × 12 + mês), para somar intervalos. */
function monthIndex(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return (y ?? 0) * 12 + ((m ?? 1) - 1);
}

type Monthly = Extract<Schedule, { kind: "monthly" }>;

/** Ciclo `n` (0 = primeiro) de um lembrete mensal. Dias além do fim do mês são ajustados. */
function monthlyCycle(schedule: Monthly, n: number): Occurrence {
  const index = monthIndex(schedule.startMonth) + n * schedule.intervalMonths;
  const year = Math.floor(index / 12);
  const month0 = index % 12;
  const last = daysInMonth(year, month0);
  const day = (d: number) => `${year}-${pad(month0 + 1)}-${pad(Math.min(d, last))}`;
  return {
    periodKey: `${year}-${pad(month0 + 1)}`,
    start: day(schedule.dayStart),
    end: day(schedule.dayEnd),
  };
}

/**
 * `current`: o ciclo mais recente que já começou (pode estar no prazo ou vencido).
 * `next`: o primeiro ciclo que ainda vai começar.
 */
export function cyclesAround(
  schedule: Schedule,
  today: string,
): { current: Occurrence | null; next: Occurrence | null } {
  if (schedule.kind === "once") {
    const occurrence = { periodKey: "once", start: schedule.dueDate, end: schedule.dueDate };
    return schedule.dueDate <= today
      ? { current: occurrence, next: null }
      : { current: null, next: occurrence };
  }

  if (schedule.kind === "weekly") {
    const back = (toDate(today).getUTCDay() - schedule.weekday + 7) % 7;
    const day = addDays(today, -back);
    const nextDay = addDays(day, 7);
    return {
      current: { periodKey: day, start: day, end: day },
      next: { periodKey: nextDay, start: nextDay, end: nextDay },
    };
  }

  const elapsed = monthIndex(today.slice(0, 7)) - monthIndex(schedule.startMonth);
  let n = elapsed < 0 ? -1 : Math.floor(elapsed / schedule.intervalMonths);
  if (n >= 0 && monthlyCycle(schedule, n).start > today) n -= 1;
  return {
    current: n >= 0 ? monthlyCycle(schedule, n) : null,
    next: monthlyCycle(schedule, n + 1),
  };
}

export function completionKey(reminderId: string, periodKey: string): string {
  return `${reminderId}|${periodKey}`;
}

/**
 * Situação do lembrete hoje. Um ciclo vale do seu início até o início do seguinte:
 * dentro do período está "no prazo"; depois dele, "atrasado" até ser marcado como feito
 * ou o próximo ciclo começar.
 */
export function reminderStatus(
  reminder: Reminder,
  doneKeys: ReadonlySet<string>,
  today: string = todayISO(),
): ReminderStatus {
  const around = cyclesAround(reminder.schedule, today);
  const { next } = around;
  // Ciclo que terminou antes de o lembrete existir não é cobrado.
  const current = around.current && around.current.end >= reminder.createdOn ? around.current : null;

  if (current) {
    if (doneKeys.has(completionKey(reminder.id, current.periodKey))) {
      return { state: next ? "done" : "finished", occurrence: current, next, days: 0 };
    }
    if (today <= current.end) {
      return { state: "active", occurrence: current, next, days: diffDays(current.end, today) };
    }
    return { state: "overdue", occurrence: current, next, days: diffDays(today, current.end) };
  }
  if (next) return { state: "upcoming", occurrence: next, next: null, days: diffDays(next.start, today) };
  return { state: "finished", occurrence: null, next: null, days: 0 };
}

const days = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

export function statusLabel(status: ReminderStatus): string {
  const { state, occurrence, next } = status;
  switch (state) {
    case "overdue":
      return `Atrasado há ${days(status.days)}`;
    case "active":
      if (status.days === 0) return "Vence hoje";
      return `No prazo: ${status.days === 1 ? "falta" : "faltam"} ${days(status.days)}`;
    case "upcoming":
      if (!occurrence) return "Em breve";
      return status.days === 1
        ? `Começa amanhã (${formatDueDate(occurrence.start)})`
        : `Começa em ${days(status.days)} (${formatDueDate(occurrence.start)})`;
    case "done":
      return next ? `Feito. Próximo: ${formatDueDate(next.start)}` : "Feito";
    case "finished":
      return "Concluído";
  }
}

/** Período do ciclo em texto: "15/10/2026 a 20/10/2026" ou uma data só. */
export function occurrenceLabel(occurrence: Occurrence): string {
  return occurrence.start === occurrence.end
    ? formatDueDate(occurrence.start)
    : `${formatDueDate(occurrence.start)} a ${formatDueDate(occurrence.end)}`;
}

export function describeSchedule(schedule: Schedule): string {
  if (schedule.kind === "once") return `Uma vez, em ${formatDueDate(schedule.dueDate)}`;
  if (schedule.kind === "weekly") {
    const label = WEEKDAY_LABELS[schedule.weekday] ?? "";
    // "Todo sábado/domingo", "Toda segunda-feira".
    return `${schedule.weekday === 0 || schedule.weekday === 6 ? "Todo" : "Toda"} ${label}`;
  }
  const every = schedule.intervalMonths === 1 ? "Todo mês" : `A cada ${schedule.intervalMonths} meses`;
  const range =
    schedule.dayStart === schedule.dayEnd
      ? `no dia ${schedule.dayStart}`
      : `do dia ${schedule.dayStart} ao dia ${schedule.dayEnd}`;
  return `${every}, ${range}`;
}

const STATE_ORDER: Record<ReminderState, number> = {
  overdue: 0,
  active: 1,
  upcoming: 2,
  done: 3,
  finished: 4,
};

/** O que exige ação primeiro: atrasados, no prazo (menos dias antes), próximos, feitos. */
export function sortByUrgency<T extends { status: ReminderStatus; reminder: Reminder }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byState = STATE_ORDER[a.status.state] - STATE_ORDER[b.status.state];
    if (byState !== 0) return byState;
    // Atrasados: o mais antigo primeiro; os demais: o que vence/começa antes.
    const byDays = a.status.state === "overdue" ? b.status.days - a.status.days : a.status.days - b.status.days;
    return byDays || a.reminder.title.localeCompare(b.reminder.title, "pt-BR");
  });
}

/** Lembretes que pedem ação agora (no prazo ou atrasados). */
export function countDue(reminders: Reminder[], doneKeys: ReadonlySet<string>, today?: string): number {
  return reminders.filter((r) => {
    const { state } = reminderStatus(r, doneKeys, today);
    return state === "active" || state === "overdue";
  }).length;
}

export function emptyReminderForm(today: string = todayISO()): ReminderFormValues {
  return {
    title: "",
    notes: "",
    kind: "monthly",
    dueDate: "",
    weekday: "1",
    intervalMonths: "1",
    startMonth: today.slice(0, 7),
    dayStart: "",
    dayEnd: "",
  };
}

export function reminderToForm(reminder: Reminder, today: string = todayISO()): ReminderFormValues {
  const base = { ...emptyReminderForm(today), title: reminder.title, notes: reminder.notes ?? "" };
  const { schedule } = reminder;
  if (schedule.kind === "once") return { ...base, kind: "once", dueDate: schedule.dueDate };
  if (schedule.kind === "weekly") return { ...base, kind: "weekly", weekday: String(schedule.weekday) };
  return {
    ...base,
    kind: "monthly",
    intervalMonths: String(schedule.intervalMonths),
    startMonth: schedule.startMonth,
    dayStart: String(schedule.dayStart),
    dayEnd: String(schedule.dayEnd),
  };
}

const toInt = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : NaN);

export type ReminderValidation =
  | { valid: true; value: ReminderInput }
  | { valid: false; errors: ReminderFormErrors };

/** `allowPastDate`: ao editar, um lembrete único já vencido pode manter a data antiga. */
export function validateReminderForm(
  values: ReminderFormValues,
  today: string = todayISO(),
  allowPastDate = false,
): ReminderValidation {
  const errors: ReminderFormErrors = {};
  const title = sanitizeText(values.title);
  const notes = sanitizeText(values.notes);
  let schedule: Schedule | undefined;

  if (title.length === 0) errors.title = "Informe o que deve ser lembrado.";
  else if (title.length > REMINDER_LIMITS.title)
    errors.title = `Use no máximo ${REMINDER_LIMITS.title} caracteres no título.`;
  if (notes.length > REMINDER_LIMITS.notes)
    errors.notes = `Use no máximo ${REMINDER_LIMITS.notes} caracteres nas observações.`;

  if (values.kind === "once") {
    if (!isValidISODate(values.dueDate)) errors.dueDate = "Informe uma data válida.";
    else if (values.dueDate < today && !allowPastDate) errors.dueDate = "Escolha hoje ou uma data futura.";
    else schedule = { kind: "once", dueDate: values.dueDate };
  } else if (values.kind === "weekly") {
    const weekday = toInt(values.weekday);
    if (!(weekday >= 0 && weekday <= 6)) errors.weekday = "Escolha um dia da semana.";
    else schedule = { kind: "weekly", weekday };
  } else {
    const interval = toInt(values.intervalMonths);
    const dayStart = toInt(values.dayStart);
    const dayEnd = toInt(values.dayEnd);
    const validDay = (d: number) => d >= 1 && d <= 31;
    if (!(MONTH_INTERVALS as readonly number[]).includes(interval))
      errors.intervalMonths = "Escolha de quanto em quanto tempo.";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(values.startMonth)) errors.startMonth = "Informe o mês de início.";
    if (!validDay(dayStart)) errors.dayStart = "Informe um dia de 1 a 31.";
    if (!validDay(dayEnd)) errors.dayEnd = "Informe um dia de 1 a 31.";
    else if (validDay(dayStart) && dayEnd < dayStart)
      errors.dayEnd = "O último dia não pode vir antes do primeiro.";
    if (Object.keys(errors).length === 0) {
      schedule = {
        kind: "monthly",
        intervalMonths: interval,
        startMonth: values.startMonth,
        dayStart,
        dayEnd,
      };
    }
  }

  if (!schedule || Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, value: { title, notes: notes || undefined, schedule } };
}
