import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState, type ReactNode } from "react";
import { PRIORITY_STYLES } from "../../constants/board";
import { useBoardAccess } from "../../hooks/useBoardAccess";
import { useNoteStore } from "../../store/noteStore";
import type { Task, TaskPriority } from "../../types/task";
import { taskArrivals } from "../../utils/arrivals";
import { Avatar } from "../ui/Avatar";
import { formatDueDate, isOverdue } from "../../utils/date";
import { notesLinkedTo, pendingItems } from "../../utils/notes";
import { DELETE_BUTTON, EDIT_BUTTON, IconButton } from "../ui/Button";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  GripIcon,
  NoteIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
} from "../ui/Icons";
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

/** Ação do rodapé: ocupa a largura do cartão, com fundo tingido pela intenção. */
const FOOTER_ACTION =
  "inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors";

/** Quanto mais responsáveis, menores os avatares, para o título não ficar espremido. */
const AVATAR_SIZE: Record<number, string> = {
  1: "h-10 w-10 text-sm",
  2: "h-9 w-9 text-sm",
  3: "h-8 w-8 text-xs",
};

/** Linha do corpo: ícone e rótulo à esquerda, valor à direita. */
function CardRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[36px] items-center justify-between gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-raised/50">
      <span className="flex items-center gap-2 text-sm font-medium text-muted">
        <span aria-hidden="true">{icon}</span>
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Visual do cartão: cabeçalho (quem faz e o quê), linhas de informação e a ação do momento
 * no rodapé. Também é usado no DragOverlay (sem ações).
 */
export function TaskCardBody({ task, handle, actions }: TaskCardBodyProps) {
  const { canManage, canApprove, personOf } = useBoardAccess();
  const notes = useNoteStore((s) => s.notes);
  const linkedNotes = useMemo(() => notesLinkedTo(notes, { type: "task", id: task.id }), [notes, task.id]);
  const missing = pendingItems(linkedNotes);
  const overdue = isOverdue(task.dueDate, task.status);
  const assignees = task.assignees.flatMap((id) => {
    const person = personOf(id);
    return person ? [{ id, name: person.lastName, avatarUrl: person.avatarUrl }] : [];
  });
  const canRequest = Boolean(actions) && !canApprove && !task.completionRequested && task.status !== "done";
  const canRespond = Boolean(actions) && canApprove && task.completionRequested;

  return (
    <article
      className="overflow-hidden rounded-2xl border border-line bg-surface transition-shadow duration-300 hover:shadow-card"
    >
      <header className="flex items-start gap-2 border-b border-line p-3">
        {handle}

        {assignees.length > 0 ? (
          <div className="flex shrink-0 -space-x-2 pt-0.5">
            {assignees.map((person) => (
              <Avatar
                key={person.id}
                id={person.id}
                name={person.name}
                url={person.avatarUrl}
                className={`ring-2 ring-surface ${AVATAR_SIZE[assignees.length] ?? AVATAR_SIZE[3]}`}
              />
            ))}
          </div>
        ) : (
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-muted"
          >
            <UsersIcon />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="break-words card-title">{task.title}</h3>
          {assignees.length > 0 ? (
            <ul aria-label="Responsáveis" className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
              {assignees.map((person) => (
                <li key={person.id}>@{person.name}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-xs italic text-muted">Sem responsável</p>
          )}
        </div>

        {actions && (
          <div className="-mr-1 -mt-1 flex shrink-0">
            <IconButton
              aria-label={`Editar ${task.title}`}
              className={EDIT_BUTTON}
              onClick={() => actions.onEdit(task)}
            >
              <PencilIcon />
            </IconButton>
            {canManage && (
              <IconButton
                aria-label={`Excluir ${task.title}`}
                className={DELETE_BUTTON}
                onClick={() => actions.onDelete(task)}
              >
                <TrashIcon />
              </IconButton>
            )}
          </div>
        )}
      </header>

      <div className="space-y-0.5 p-2">
        {task.description && (
          <p className="line-clamp-3 whitespace-pre-line break-words px-2 pb-1 pt-0.5 text-sm text-muted">
            {task.description}
          </p>
        )}

        <CardRow icon={<FlagIcon />} label="Prioridade">
          {actions ? (
            <PrioritySelect
              value={task.priority}
              label={`Prioridade de ${task.title}`}
              onChange={(priority) => actions.onPriorityChange(task.id, priority)}
            />
          ) : (
            <PriorityBadge priority={task.priority} />
          )}
        </CardRow>

        {task.dueDate && (
          <CardRow icon={<CalendarIcon />} label={overdue ? "Atrasada" : "Vence"}>
            <span
              className={`rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${
                overdue ? "bg-prio-urgent-tint text-prio-urgent" : "text-ink"
              }`}
            >
              {formatDueDate(task.dueDate)}
            </span>
          </CardRow>
        )}

        {linkedNotes.length > 0 && (
          <CardRow icon={<NoteIcon />} label="Notas">
            <span
              className={`rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${
                missing > 0 ? "bg-prio-medium-tint text-prio-medium" : "text-ink"
              }`}
            >
              {missing > 0 ? (missing === 1 ? "falta 1 item" : `faltam ${missing} itens`) : linkedNotes.length}
            </span>
          </CardRow>
        )}

        {task.completionRequested && (
          <CardRow icon={<ClockIcon />} label="Conclusão">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-prio-medium-tint px-2 py-1 text-xs font-semibold text-prio-medium">
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-attention rounded-full bg-prio-medium" />
              Aguardando aprovação
            </span>
          </CardRow>
        )}

        {actions && canRespond && (
          <div className="flex gap-2 px-1 pb-1 pt-1.5">
            <button
              type="button"
              aria-label={`Aprovar conclusão de ${task.title}`}
              onClick={() => actions.onRespond(task, true)}
              className={`${FOOTER_ACTION} bg-prio-low-tint text-prio-low hover:bg-prio-low/25`}
            >
              <CheckIcon />
              Aprovar
            </button>
            <button
              type="button"
              aria-label={`Devolver ${task.title}`}
              onClick={() => actions.onRespond(task, false)}
              className={`${FOOTER_ACTION} bg-raised/70 text-ink hover:bg-raised`}
            >
              Devolver
            </button>
          </div>
        )}

        {actions && canRequest && (
          <div className="flex px-1 pb-1 pt-1.5">
            <button
              type="button"
              aria-label={`Pedir conclusão de ${task.title}`}
              onClick={() => actions.onRequestCompletion(task)}
              className={`${FOOTER_ACTION} bg-accent-soft text-accent-light hover:bg-accent/30`}
            >
              <CheckIcon />
              Pedir conclusão
            </button>
          </div>
        )}
      </div>

      {/* Faixa de prioridade na base do cartão; o nome da prioridade está no selo acima. */}
      <div aria-hidden="true" className={`h-1.5 ${PRIORITY_STYLES[task.priority].band}`} />
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
  // Decidido uma vez, ao montar: o cartão é novo, chegou de outra coluna ou já estava aqui.
  const [arrival] = useState(() => taskArrivals.observe(task.id, task.status));
  const arrivalClass =
    arrival === "moved" ? "animate-arrive" : arrival === "new" ? "animate-enter" : "";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl ${arrivalClass} ${isDragging ? "opacity-40" : ""}`}
    >
      <TaskCardBody
        task={task}
        actions={actions}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Arrastar ${task.title}`}
            className="-ml-1 inline-flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-canvas/60 hover:text-ink active:cursor-grabbing"
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
          <span className="-ml-1 inline-flex h-10 w-6 shrink-0 items-center justify-center text-muted">
            <GripIcon />
          </span>
        }
      />
    </div>
  );
}
