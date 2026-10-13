import type { DayEvents } from "../../types/calendar";
import { longDate, WEEKDAY_SHORT } from "../../utils/calendar";

interface MonthGridProps {
  /** Semanas do mês (`monthGrid`). */
  weeks: string[][];
  /** Mês em exibição (YYYY-MM): os dias dos meses vizinhos ficam apagados. */
  month: string;
  today: string;
  selected: string;
  events: ReadonlyMap<string, DayEvents>;
  onSelect: (date: string) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Nome do dia para leitores de tela: a data e o que cai nela. */
function describeDay(date: string, events: DayEvents | undefined): string {
  const parts = [longDate(date)];
  if (events) {
    for (const holiday of events.holidays) parts.push(holiday.name);
    if (events.tasks.length > 0) parts.push(plural(events.tasks.length, "tarefa", "tarefas"));
    if (events.reminders.length > 0) parts.push(plural(events.reminders.length, "lembrete", "lembretes"));
  }
  return parts.join(", ");
}

function Count({ count, dot, label }: { count: number; dot: string; label: string }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-semibold tabular-nums text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {count}
      <span className="hidden font-medium lg:inline">{label}</span>
    </span>
  );
}

/** Grade do mês. Cada dia é um botão; o detalhe do dia escolhido aparece ao lado. */
export function MonthGrid({ weeks, month, today, selected, events, onSelect }: MonthGridProps) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div aria-hidden="true" className="grid grid-cols-7 border-b border-line">
        {WEEKDAY_SHORT.map((day) => (
          <span key={day} className="py-2 text-center text-2xs font-semibold uppercase tracking-wider text-muted">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((date) => {
          const dayEvents = events.get(date);
          const holiday = dayEvents?.holidays[0];
          const outside = date.slice(0, 7) !== month;
          const isToday = date === today;
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={describeDay(date, dayEvents)}
              onClick={() => onSelect(date)}
              className={`relative flex min-h-[58px] flex-col items-start gap-1 border-b border-r border-line p-1.5 text-left transition-colors hover:bg-raised/60 focus-visible:z-10 sm:min-h-[92px] sm:p-2 ${
                isSelected ? "bg-accent-soft ring-2 ring-inset ring-accent" : holiday ? "bg-magenta/10" : ""
              } ${outside ? "opacity-40" : ""}`}
            >
              <span
                className={`flex h-6 min-w-[24px] items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ${
                  isToday ? "bg-accent text-white" : holiday ? "text-magenta" : "text-ink"
                }`}
              >
                {Number(date.slice(8, 10))}
              </span>
              {holiday && (
                <span className="hidden w-full truncate text-2xs font-medium text-magenta sm:block">
                  {holiday.name}
                </span>
              )}
              <span className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5">
                <Count
                  count={dayEvents?.tasks.length ?? 0}
                  dot="bg-accent-light"
                  label={dayEvents?.tasks.length === 1 ? "tarefa" : "tarefas"}
                />
                <Count
                  count={dayEvents?.reminders.length ?? 0}
                  dot="bg-prio-medium"
                  label={dayEvents?.reminders.length === 1 ? "lembrete" : "lembretes"}
                />
              </span>
            </button>
          );
        })}
      </div>
      <p aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-2xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-magenta/60" /> Feriado ou recesso
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-light" /> Tarefas (prazo)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-prio-medium" /> Lembretes
        </span>
      </p>
    </div>
  );
}
