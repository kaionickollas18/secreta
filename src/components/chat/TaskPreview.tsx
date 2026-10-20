import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS } from "../../constants/board";
import type { Task } from "../../types/task";
import { formatDueDate } from "../../utils/date";
import { taskHref } from "../../utils/tasks";
import { ButtonLink } from "../ui/Button";
import { BoardIcon } from "../ui/Icons";

interface TaskPreviewProps {
  task: Task;
  /** Nome exibido de um responsável. */
  nameOf: (id: string) => string;
}

/** Resumo de uma tarefa marcada com `#` numa conversa, com o caminho para abri-la no quadro. */
export function TaskPreview({ task, nameOf }: TaskPreviewProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${PRIORITY_STYLES[task.priority].badge}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        <span>{STATUS_LABELS[task.status]}</span>
        {task.completionRequested && <span>· Aguardando aprovação</span>}
        {task.dueDate && <span className="tabular-nums">· Vence {formatDueDate(task.dueDate)}</span>}
      </p>
      {task.description && <p className="whitespace-pre-line break-words text-sm">{task.description}</p>}
      <p className="caption">
        Responsáveis: {task.assignees.length > 0 ? task.assignees.map(nameOf).join(", ") : "sem responsável"}
      </p>
      <ButtonLink variant="primary" href={taskHref(task.id)} className="self-start">
        <BoardIcon />
        Abrir no quadro
      </ButtonLink>
    </div>
  );
}
