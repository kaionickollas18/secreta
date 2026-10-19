export const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Ids (profiles) do secretário e/ou auxiliares responsáveis. */
  assignees: string[];
  /** Data no formato YYYY-MM-DD (sem fuso horário). */
  dueDate?: string;
  /** O auxiliar pediu a conclusão e aguarda o secretário. */
  completionRequested: boolean;
  /** Ordem dentro do quadro (menor primeiro). */
  position: number;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  /** ISO 8601. Quando entrou em Concluído (preenchido pelo banco). */
  completedAt?: string;
}

/** Dados editáveis de uma tarefa, já validados e normalizados. */
export interface TaskInput {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignees: string[];
  dueDate?: string;
}

/** Valores crus do formulário (sempre strings). */
export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignees: string[];
  dueDate: string;
}

export type FieldErrors = Partial<Record<keyof TaskFormValues, string>>;

export interface TaskFilters {
  query: string;
  priority: TaskPriority | "all";
  /** Id de um responsável, "none" (sem responsável) ou "all". */
  assignee: string;
  overdueOnly: boolean;
}

/** Registro permanente de uma tarefa concluída (tabela `task_history`). */
export interface HistoryEntry {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  assigneeNames: string[];
  dueDate?: string;
  /** ISO 8601 */
  taskCreatedAt: string;
  /** ISO 8601 */
  completedAt: string;
  completedByName?: string;
}
