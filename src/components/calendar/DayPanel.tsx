import type { ReactNode } from "react";
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS } from "../../constants/board";
import type { DayEvents, Holiday } from "../../types/calendar";
import { longDate, weekdayOf } from "../../utils/calendar";
import { HOLIDAY_SOURCE_LABELS } from "../../utils/holidays";
import { describeSchedule, occurrenceLabel, WEEKDAY_LABELS } from "../../utils/reminders";
import { Button, DELETE_BUTTON, EDIT_BUTTON, IconButton } from "../ui/Button";
import { PencilIcon, PlusIcon, TrashIcon } from "../ui/Icons";

interface DayPanelProps {
  date: string;
  events: DayEvents | undefined;
  /** Só o Secretário cadastra feriados; sem isso o painel é somente leitura. */
  canManage: boolean;
  /** Sobrenome do responsável ("" se a pessoa não existe mais). */
  nameOf: (id: string) => string;
  onAddHoliday: (date: string) => void;
  onEditHoliday: (holiday: Holiday) => void;
  onDeleteHoliday: (holiday: Holiday) => void;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

const ITEM = "rounded-xl border border-line bg-canvas/40 px-3 py-2";
const CHIP = "rounded-full px-2 py-0.5 text-2xs font-semibold";

/** Detalhe do dia escolhido no calendário: feriados, tarefas com prazo e lembretes. */
export function DayPanel({
  date,
  events,
  canManage,
  nameOf,
  onAddHoliday,
  onEditHoliday,
  onDeleteHoliday,
}: DayPanelProps) {
  const weekday = WEEKDAY_LABELS[weekdayOf(date)] ?? "";
  const empty = !events;

  return (
    <section aria-label="Dia escolhido" className="glass flex flex-col gap-4 rounded-2xl p-4">
      <div>
        <h2 className="section-title">{longDate(date)}</h2>
        <p className="caption first-letter:uppercase">{weekday}</p>
      </div>

      {empty && <p className="text-sm text-muted">Nada marcado neste dia.</p>}

      {events && events.holidays.length > 0 && (
        <Group title="Feriado ou recesso">
          {events.holidays.map((holiday) => (
            <li key={holiday.id} className={`${ITEM} flex items-start gap-2 border-magenta/40`}>
              <div className="min-w-0 flex-1">
                <p className="break-words card-title">{holiday.name}</p>
                <p className="caption">
                  {HOLIDAY_SOURCE_LABELS[holiday.source]}
                  {holiday.start !== holiday.end && ` · ${occurrenceLabel({ periodKey: "", ...holiday })}`}
                </p>
              </div>
              {canManage && holiday.source === "school" && (
                <div className="flex shrink-0">
                  <IconButton
                    aria-label={`Editar ${holiday.name}`}
                    className={EDIT_BUTTON}
                    onClick={() => onEditHoliday(holiday)}
                  >
                    <PencilIcon />
                  </IconButton>
                  <IconButton
                    aria-label={`Excluir ${holiday.name}`}
                    className={DELETE_BUTTON}
                    onClick={() => onDeleteHoliday(holiday)}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </Group>
      )}

      {events && events.tasks.length > 0 && (
        <Group title="Tarefas com prazo neste dia">
          {events.tasks.map((task) => {
            const names = task.assignees.map(nameOf).filter(Boolean);
            return (
              <li key={task.id} className={`${ITEM} ${task.status === "done" ? "opacity-60" : ""}`}>
                <p className="break-words card-title">{task.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className={`${CHIP} ${PRIORITY_STYLES[task.priority].badge}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  <span>{STATUS_LABELS[task.status]}</span>
                  {names.length > 0 && <span>{names.map((name) => `@${name}`).join(" ")}</span>}
                </p>
              </li>
            );
          })}
        </Group>
      )}

      {events && events.reminders.length > 0 && (
        <Group title="Lembretes">
          {events.reminders.map(({ reminder, occurrence, done }) => (
            <li key={`${reminder.id}|${occurrence.periodKey}`} className={ITEM}>
              <p className="break-words card-title">{reminder.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span
                  className={`${CHIP} ${done ? "bg-prio-low-tint text-prio-low" : "bg-prio-medium-tint text-prio-medium"}`}
                >
                  {done ? "Feito" : "Pendente"}
                </span>
                <span>
                  {occurrence.start === occurrence.end
                    ? describeSchedule(reminder.schedule)
                    : `Período: ${occurrenceLabel(occurrence)}`}
                </span>
              </p>
            </li>
          ))}
        </Group>
      )}

      {canManage && (
        <Button className="self-start" onClick={() => onAddHoliday(date)}>
          <PlusIcon />
          Feriado neste dia
        </Button>
      )}
    </section>
  );
}
