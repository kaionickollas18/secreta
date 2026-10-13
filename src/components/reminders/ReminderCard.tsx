import type { Reminder, ReminderState, ReminderStatus } from "../../types/reminder";
import { describeSchedule, occurrenceLabel, statusLabel } from "../../utils/reminders";
import { LinkedNotes } from "../notes/LinkedNotes";
import { Button, DELETE_BUTTON, EDIT_BUTTON, IconButton } from "../ui/Button";
import { CheckIcon, PencilIcon, TrashIcon } from "../ui/Icons";

/** `edge`: contorno do cartão (1px), forte só no que pede ação. `chip`: o selo com a situação. */
const STATE_STYLES: Record<ReminderState, { edge: string; chip: string }> = {
  overdue: { edge: "border-prio-urgent/75", chip: "bg-prio-urgent-tint text-prio-urgent" },
  active: { edge: "border-prio-medium/55", chip: "bg-prio-medium-tint text-prio-medium" },
  upcoming: { edge: "border-line", chip: "bg-accent-soft text-accent-light" },
  done: { edge: "border-prio-low/30", chip: "bg-prio-low-tint text-prio-low" },
  finished: { edge: "border-line", chip: "bg-raised/60 text-muted" },
};

interface ReminderCardProps {
  reminder: Reminder;
  status: ReminderStatus;
  /** Só o Secretário gerencia; sem isso o cartão é somente leitura. */
  canManage: boolean;
  onToggleDone: (reminder: Reminder, periodKey: string, done: boolean) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}

export function ReminderCard({ reminder, status, canManage, onToggleDone, onEdit, onDelete }: ReminderCardProps) {
  const { state, occurrence } = status;
  const styles = STATE_STYLES[state];
  const pending = state === "active" || state === "overdue";
  const completed = state === "done" || state === "finished";

  return (
    <li className={`glass rounded-2xl p-4 ${styles.edge}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="break-words section-title">{reminder.title}</h3>
          <p className="mt-0.5 caption">{describeSchedule(reminder.schedule)}</p>
        </div>
        {canManage && (
          <div className="flex shrink-0">
            <IconButton aria-label={`Editar ${reminder.title}`} className={EDIT_BUTTON} onClick={() => onEdit(reminder)}>
              <PencilIcon />
            </IconButton>
            <IconButton aria-label={`Excluir ${reminder.title}`} className={DELETE_BUTTON} onClick={() => onDelete(reminder)}>
              <TrashIcon />
            </IconButton>
          </div>
        )}
      </div>

      {reminder.notes && (
        <p className="mt-2 whitespace-pre-line break-words text-sm text-muted">{reminder.notes}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles.chip}`}>
          {statusLabel(status)}
        </span>
        {/* Em "começa em…" de um dia só, a data já está no selo. */}
        {occurrence && (state !== "upcoming" || occurrence.start !== occurrence.end) && (
          <span className="text-xs text-muted">Período: {occurrenceLabel(occurrence)}</span>
        )}
      </div>

      <LinkedNotes link={{ type: "reminder", id: reminder.id }} className="mt-3 border-t border-line pt-3" />

      {canManage && occurrence && (pending || completed) && (
        <div className="mt-3">
          {pending ? (
            <Button
              variant="primary"
              aria-label={`Marcar ${reminder.title} como feito`}
              onClick={() => onToggleDone(reminder, occurrence.periodKey, true)}
            >
              <CheckIcon />
              Marcar como feito
            </Button>
          ) : (
            <Button
              variant="ghost"
              aria-label={`Desfazer a conclusão de ${reminder.title}`}
              onClick={() => onToggleDone(reminder, occurrence.periodKey, false)}
            >
              Desfazer
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
