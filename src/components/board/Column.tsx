import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useId } from "react";
import {
  COLUMN_PREFIX,
  EMPTY_COLUMN_HINTS,
  STATUS_DOT,
  STATUS_LABELS,
} from "../../constants/board";
import { useBoardAccess } from "../../hooks/useBoardAccess";
import { useTaskStore } from "../../store/taskStore";
import type { Task, TaskStatus } from "../../types/task";
import { TaskCard, type CardActions } from "../task/TaskCard";
import { IconButton, Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { PlusIcon } from "../ui/Icons";
import { Skeleton } from "../ui/Skeleton";

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
  total: number;
  filtersActive: boolean;
  onAdd: (status: TaskStatus) => void;
  actions: CardActions;
}

export function Column({ status, tasks, total, filtersActive, onAdd, actions }: ColumnProps) {
  const headingId = useId();
  const { canManage } = useBoardAccess();
  const loading = useTaskStore((s) => s.status === "idle" || s.status === "loading");
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${status}` });
  const label = STATUS_LABELS[status];
  const countText = filtersActive ? `${tasks.length} de ${total}` : String(total);
  // Tarefas nascem fora de Concluído: concluir é sempre uma ação posterior.
  const canAddHere = canManage && status !== "done";

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-[88vw] max-w-[26rem] shrink-0 snap-center flex-col glass rounded-3xl p-4 sm:w-[22rem] lg:w-[24rem] xl:w-auto xl:max-w-none xl:min-w-0 xl:flex-1"
    >
      <header className="flex min-h-[48px] items-center gap-2 px-2 py-1.5">
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
        <h2 id={headingId} className="flex-1 card-title">
          {label}
        </h2>
        <span className="text-sm tabular-nums text-muted" aria-label={`${countText} tarefas`}>
          {countText}
        </span>
        {canAddHere && (
          <IconButton aria-label={`Adicionar tarefa em ${label}`} onClick={() => onAdd(status)}>
            <PlusIcon />
          </IconButton>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={`min-h-[120px] flex-1 rounded-2xl p-1 transition-colors ${isOver ? "bg-accent-soft ring-1 ring-accent/50" : ""}`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {loading && tasks.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          ) : tasks.length > 0 ? (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} actions={actions} />
              ))}
            </ul>
          ) : filtersActive && total > 0 ? (
            <EmptyState title="Nada por aqui com esses filtros" />
          ) : (
            <EmptyState
              title="Nenhuma tarefa"
              description={EMPTY_COLUMN_HINTS[status]}
              action={
                canAddHere ? (
                  <Button variant="ghost" onClick={() => onAdd(status)}>
                    Adicionar tarefa
                  </Button>
                ) : undefined
              }
            />
          )}
        </SortableContext>
      </div>
    </section>
  );
}
