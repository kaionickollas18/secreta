import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { COLUMN_PREFIX, REQUESTED_MESSAGE, STATUS_LABELS } from "../../constants/board";
import { useBoardAccess } from "../../hooks/useBoardAccess";
import { useTaskStore } from "../../store/taskStore";
import { useToastStore } from "../../store/toastStore";
import { TASK_STATUSES, type Task, type TaskStatus } from "../../types/task";
import { taskArrivals } from "../../utils/arrivals";
import { isTaskStatus } from "../../utils/guards";
import { TaskCardOverlay, type CardActions } from "../task/TaskCard";
import { Column } from "./Column";

interface BoardProps {
  grouped: Record<TaskStatus, Task[]>;
  totals: Record<string, number>;
  filtersActive: boolean;
  onAdd: (status: TaskStatus) => void;
  actions: CardActions;
}

export function Board({ grouped, totals, filtersActive, onAdd, actions }: BoardProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const moveTask = useTaskStore((s) => s.moveTask);
  const pushToast = useToastStore((s) => s.push);
  const { role } = useBoardAccess();
  const loaded = useTaskStore((s) => s.status === "ready");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Os cartões da primeira carga não animam; só o que chegar ou mudar de coluna depois.
  useEffect(() => {
    if (loaded) taskArrivals.prime();
  }, [loaded]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : undefined;

  const announcements = useMemo<Announcements>(() => {
    const titleOf = (id: string | number) => tasks.find((t) => t.id === id)?.title ?? "tarefa";
    const targetOf = (id: string | number): string | undefined => {
      const key = String(id);
      if (key.startsWith(COLUMN_PREFIX)) {
        const status = key.slice(COLUMN_PREFIX.length);
        return isTaskStatus(status) ? STATUS_LABELS[status] : undefined;
      }
      const task = tasks.find((t) => t.id === key);
      return task ? STATUS_LABELS[task.status] : undefined;
    };
    return {
      onDragStart: ({ active }) => `Tarefa “${titleOf(active.id)}” selecionada.`,
      onDragOver: ({ active, over }) => {
        const target = over ? targetOf(over.id) : undefined;
        return target ? `“${titleOf(active.id)}” sobre a coluna ${target}.` : undefined;
      },
      onDragEnd: ({ active, over }) => {
        const target = over ? targetOf(over.id) : undefined;
        return target
          ? `“${titleOf(active.id)}” solta na coluna ${target}.`
          : `“${titleOf(active.id)}” solta fora das colunas.`;
      },
      onDragCancel: ({ active }) => `Movimento de “${titleOf(active.id)}” cancelado.`,
    };
  }, [tasks]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged) return;

    const overKey = String(over.id);
    let targetStatus: TaskStatus;
    let overTaskId: string | undefined;

    if (overKey.startsWith(COLUMN_PREFIX)) {
      const status = overKey.slice(COLUMN_PREFIX.length);
      if (!isTaskStatus(status)) return;
      targetStatus = status;
    } else {
      const overTask = tasks.find((t) => t.id === overKey);
      if (!overTask || overTask.id === dragged.id) return;
      targetStatus = overTask.status;
      overTaskId = overTask.id;
    }

    void moveTask(dragged.id, targetStatus, overTaskId, role).then(({ error, outcome }) => {
      if (error) pushToast({ tone: "error", message: error });
      else if (outcome === "requested") {
        pushToast({ tone: "info", message: REQUESTED_MESSAGE });
      } else if (outcome === "moved") {
        pushToast({ tone: "success", message: `Tarefa movida para ${STATUS_LABELS[targetStatus]}.` });
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para mover, pressione espaço ou Enter no botão de arrastar, use as setas para escolher a posição e pressione espaço novamente para soltar. Esc cancela.",
        },
      }}
    >
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 xl:snap-none">
        {TASK_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={grouped[status]}
            total={totals[status] ?? 0}
            filtersActive={filtersActive}
            onAdd={onAdd}
            actions={actions}
          />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCardOverlay task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  );
}
