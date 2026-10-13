import type { DayEvents, Holiday } from "../types/calendar";
import type { Reminder } from "../types/reminder";
import type { Task } from "../types/task";
import { addDays, completionKey, occurrencesBetween } from "./reminders";

export const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Cabeçalho da grade, começando no domingo. */
export const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** 0 = domingo … 6 = sábado. UTC só como calendário neutro: as datas não têm fuso. */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** Soma `delta` meses a um mês YYYY-MM. */
export function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const index = (y ?? 0) * 12 + ((m ?? 1) - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** "outubro de 2026". */
export function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1] ?? ""} de ${y ?? ""}`;
}

/** "13 de outubro de 2026". */
export function longDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} de ${monthLabel(iso.slice(0, 7))}`;
}

/**
 * Semanas do mês (domingo a sábado), completadas com os dias vizinhos dos meses ao lado,
 * para a grade ficar sempre retangular.
 */
export function monthGrid(yearMonth: string): string[][] {
  const first = `${yearMonth}-01`;
  const last = addDays(`${shiftMonth(yearMonth, 1)}-01`, -1);
  const weeks: string[][] = [];
  for (let day = addDays(first, -weekdayOf(first)); day <= last; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
  }
  return weeks;
}

interface CalendarSources {
  tasks: Task[];
  reminders: Reminder[];
  doneKeys: ReadonlySet<string>;
  holidays: Holiday[];
}

/**
 * O que cai em cada dia de `from` a `to`: tarefas pelo prazo, lembretes em todos os dias do
 * seu período e feriados em todos os dias que duram. Dias sem nada não entram no mapa.
 */
export function buildCalendar(from: string, to: string, sources: CalendarSources): Map<string, DayEvents> {
  const days = new Map<string, DayEvents>();
  const at = (date: string): DayEvents => {
    let events = days.get(date);
    if (!events) {
      events = { holidays: [], tasks: [], reminders: [] };
      days.set(date, events);
    }
    return events;
  };
  /** Chama `visit` para cada dia do período que cai dentro do intervalo pedido. */
  const span = (start: string, end: string, visit: (events: DayEvents) => void) => {
    const stop = end < to ? end : to;
    for (let day = start > from ? start : from; day <= stop; day = addDays(day, 1)) visit(at(day));
  };

  for (const holiday of sources.holidays) {
    span(holiday.start, holiday.end, (events) => events.holidays.push(holiday));
  }
  for (const task of sources.tasks) {
    if (task.dueDate && task.dueDate >= from && task.dueDate <= to) at(task.dueDate).tasks.push(task);
  }
  for (const reminder of sources.reminders) {
    for (const occurrence of occurrencesBetween(reminder.schedule, from, to)) {
      // Ciclo que terminou antes de o lembrete existir não aparece (como na lista de lembretes).
      if (occurrence.end < reminder.createdOn) continue;
      const done = sources.doneKeys.has(completionKey(reminder.id, occurrence.periodKey));
      span(occurrence.start, occurrence.end, (events) =>
        events.reminders.push({ reminder, occurrence, done }),
      );
    }
  }
  return days;
}
