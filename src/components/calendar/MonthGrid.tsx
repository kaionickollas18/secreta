import { EVENT_KINDS, type DayEvents } from "../../types/calendar";
import { longDate, WEEKDAY_SHORT } from "../../utils/calendar";
import { EVENT_KIND_LABELS } from "../../utils/holidays";
import { dayFill, KIND_STYLES, KindChip, KindIcon, ON_FILL } from "./KindIcon";

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

function Count({ count, dot, label, tone }: { count: number; dot: string; label: string; tone: string }) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-2xs font-semibold tabular-nums ${tone}`}>
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
        {WEEKDAY_SHORT.map((day, index) => (
          <span
            key={day}
            className={`py-2 text-center text-2xs uppercase tracking-wider ${
              index === 0 || index === 6 ? "font-bold text-red-400" : "font-semibold text-muted"
            }`}
          >
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((date, index) => {
          const dayEvents = events.get(date);
          const marks = dayEvents?.holidays ?? [];
          const first = marks[0];
          // Feriado, recesso e os eventos em verde preenchem o quadro do dia com a cor pastel.
          const fill = dayFill(marks.map((mark) => mark.kind));
          const filled = fill !== "";
          const tone = filled ? ON_FILL : "text-muted";
          // Sábado e domingo: número em vermelho e mais pesado.
          const weekend = index % 7 === 0 || index % 7 === 6;
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
              className={`relative flex min-h-[62px] flex-col items-start gap-1 border-b border-r border-line p-1.5 text-left transition-[background-color,filter] focus-visible:z-10 sm:min-h-[96px] sm:p-2 ${
                filled ? `${fill} hover:brightness-110` : `hover:bg-raised/60 ${isSelected ? "bg-accent-soft" : ""}`
              } ${isSelected ? "z-[1] ring-[3px] ring-inset ring-accent" : ""} ${outside ? "opacity-40" : ""}`}
            >
              <span className="flex w-full flex-wrap items-center gap-x-1 gap-y-0.5">
                <span
                  className={`flex h-6 min-w-[24px] items-center justify-center rounded-full px-1 text-xs tabular-nums ${
                    weekend ? "font-bold" : "font-semibold"
                  } ${
                    isToday
                      ? "bg-accent text-white"
                      : weekend
                        ? filled
                          ? "text-red-700"
                          : "text-red-400"
                        : filled
                          ? ON_FILL
                          : "text-ink"
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </span>
                {marks.slice(0, 3).map((mark) => (
                  <KindIcon key={mark.id} kind={mark.kind} size="h-4 w-4 sm:h-[18px] sm:w-[18px]" onFill={filled} />
                ))}
                {marks.length > 3 && <span className={`text-2xs font-semibold ${tone}`}>+{marks.length - 3}</span>}
              </span>
              {first && (
                <span
                  className={`hidden w-full truncate text-2xs sm:block ${
                    filled ? `font-semibold ${ON_FILL}` : `font-medium ${KIND_STYLES[first.kind].text}`
                  }`}
                >
                  {first.name}
                </span>
              )}
              <span className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5">
                <Count
                  count={dayEvents?.tasks.length ?? 0}
                  dot={filled ? "bg-violet-700" : "bg-accent-light"}
                  tone={tone}
                  label={dayEvents?.tasks.length === 1 ? "tarefa" : "tarefas"}
                />
                <Count
                  count={dayEvents?.reminders.length ?? 0}
                  dot={filled ? "bg-amber-700" : "bg-prio-medium"}
                  tone={tone}
                  label={dayEvents?.reminders.length === 1 ? "lembrete" : "lembretes"}
                />
              </span>
            </button>
          );
        })}
      </div>
      <ul aria-label="Legenda" className="flex flex-wrap gap-x-4 gap-y-1.5 px-3 py-2.5 text-2xs text-muted">
        {EVENT_KINDS.map((kind) => (
          <li key={kind} className="inline-flex items-center gap-1.5">
            <KindChip kind={kind} className="h-5 w-5" />
            {EVENT_KIND_LABELS[kind]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-light" /> Tarefas (prazo)
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-prio-medium" /> Lembretes
        </li>
      </ul>
    </div>
  );
}
