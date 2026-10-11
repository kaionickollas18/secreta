import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { PRIORITY_STYLES } from "../../constants/board";
import { useBoardAccess } from "../../hooks/useBoardAccess";
import type { Task, TaskPriority } from "../../types/task";
import { formatDueDate, isOverdue } from "../../utils/date";
import { GripIcon, PencilIcon, TrashIcon } from "../ui/Icons";
import { Button, IconButton } from "../ui/Button";
import { AssigneeBadge } from "./AssigneeBadge";
import { PriorityBadge } from "./PriorityBadge";
import { PrioritySelect } from "./PrioritySelect";

/** Ações disponíveis em um cartão. O que cada papel pode usar é decidido aqui e no banco. */
export interface CardActions {
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onPriorityChange: (id: string, priority: TaskPriority) => void;
  /** Auxiliar pede a conclusão. */
  onRequestCompletion: (task: Task) => void;
  /** Secretário aprova (`true`) ou devolve (`false`) o pedido. */
  onRespond: (task: Task, approve: boolean) => void;
}

interface TaskCardBodyProps {
  task: Task;
  handle: ReactNode;
  /** Sem ações, o cartão é só visual (usado no DragOverlay). */
  actions?: CardActions;
}

const SMALL_BUTTON = "!min-h-[32px] px-2.5 text-xs";

/** Visual do cartão. Também é usado no DragOverlay (sem ações). */
export function TaskCardBody({ task, handle, actions }: TaskCardBodyProps) {
  const { canManage, canApprove, nameOf } = useBoardAccess();
  const overdue = isOverdue(task.dueDate, task.status);
  const assignees = task.assignees.flatMap((id) => {
    const name = nameOf(id);
    return name ? [{ id, name }] : [];
  });

  return (
    <article
      className={`rounded-2xl border border-line border-l-4 bg-surface p-3 shadow-card transition-colors hover:bg-raised ${PRIORITY_STYLES[task.priority].stripe}`}
    >
      <div className="flex items-start gap-1">
        {handle}
        <h3 className="min-w-0 flex-1 break-words pt-1.5 text-sm font-semibold leading-snug">
          {task.title}
        </h3>
        {actions && (
          <div className="flex shrink-0">
            <IconButton aria-label={`Editar ${task.title}`} onClick={() => actions.onEdit(task)}>
              <PencilIcon />
            </IconButton>
            {canManage && (
              <IconButton aria-label={`Excluir ${task.title}`} onClick={() => actions.onDelete(task)}>
                <TrashIcon />
              </IconButton>
            )}
          </div>
        )}
      </div>

      {task.description && (
        <p className="mt-1 line-clamp-3 whitespace-pre-line break-words pl-9 text-sm text-muted">
          {task.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-9">
        {assignees.length > 0 ? (
          <ul aria-label="Responsáveis" className="flex flex-wrap gap-1.5">
            {assignees.map((person) => (
              <li key={person.id}>
                <AssigneeBadge id={person.id} name={person.name} />
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-xs italic text-muted">Sem responsável</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
        {actions ? (
          <PrioritySelect
            value={task.priority}
            label={`Prioridade de ${task.title}`}
            onChange={(priority) => actions.onPriorityChange(task.id, priority)}
          />
        ) : (
          <PriorityBadge priority={task.priority} />
        )}
        {task.dueDate && (
          <span
            className={`text-xs ${overdue ? "font-semibold text-prio-urgent" : "text-muted"}`}
          >
            {overdue ? "Atrasada: " : "Vence "}
            {formatDueDate(task.dueDate)}
          </span>
        )}
      </div>

      {task.completionRequested && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-9">
          <span className="rounded-full border border-prio-medium bg-prio-medium-tint px-2 py-0.5 text-xs font-semibold text-prio-medium">
            Aguardando aprovação
          </span>
          {actions && canApprove && (
            <>
              <Button
                variant="primary"
                className={SMALL_BUTTON}
                aria-label={`Aprovar conclusão de ${task.title}`}
                onClick={() => actions.onRespond(task, true)}
              >
                Aprovar
              </Button>
              <Button
                className={SMALL_BUTTON}
                aria-label={`Devolver ${task.title}`}
                onClick={() => actions.onRespond(task, false)}
              >
                Devolver
              </Button>
            </>
          )}
        </div>
      )}

      {actions && !canApprove && !task.completionRequested && task.status !== "done" && (
        <div className="mt-3 pl-9">
          <Button
            className={SMALL_BUTTON}
            aria-label={`Pedir conclusão de ${task.title}`}
            onClick={() => actions.onRequestCompletion(task)}
          >
            Pedir conclusão
          </Button>
        </div>
      )}
    </article>
  );
}

interface TaskCardProps {
  task: Task;
  actions: CardActions;
}

export function TaskCard({ task, actions }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : undefined}
    >
      <TaskCardBody
        task={task}
        actions={actions}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Arrastar ${task.title}`}
            className="inline-flex h-9 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-canvas/60 hover:text-ink active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
        }
      />
    </li>
  );
}

export function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="rotate-1 shadow-xl">
      <TaskCardBody
        task={task}
        handle={
          <span className="inline-flex h-9 w-8 shrink-0 items-center justify-center text-muted">
            <GripIcon />
          </span>
        }
      />
    </div>
  );
}
