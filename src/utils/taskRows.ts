import type { HistoryEntry, Task, TaskInput } from "../types/task";
import { isTaskPriority, isTaskStatus } from "./guards";

/** Linha da tabela `tasks` como chega do banco (dado externo: validar antes de usar). */
export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_ids: string[] | null;
  due_date: string | null;
  completion_requested: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export const TASK_COLUMNS =
  "id, title, description, status, priority, assignee_ids, due_date, completion_requested, position, created_at, updated_at";

/** Converte a linha do banco. Devolve `null` se status/prioridade forem desconhecidos. */
export function taskFromRow(row: TaskRow): Task | null {
  if (!isTaskStatus(row.status) || !isTaskPriority(row.priority)) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    priority: row.priority,
    assignees: row.assignee_ids ?? [],
    dueDate: row.due_date ?? undefined,
    completionRequested: row.completion_requested,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Campos editáveis no formato do banco. */
export function inputToRow(input: TaskInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    status: input.status,
    priority: input.priority,
    assignee_ids: input.assignees,
    due_date: input.dueDate ?? null,
  };
}

export interface HistoryRow {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assignee_names: string[] | null;
  due_date: string | null;
  task_created_at: string;
  completed_at: string;
  completed_by_name: string | null;
}

export const HISTORY_COLUMNS =
  "id, title, description, priority, assignee_names, due_date, task_created_at, completed_at, completed_by_name";

export function historyFromRow(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    priority: isTaskPriority(row.priority) ? row.priority : "medium",
    assigneeNames: row.assignee_names ?? [],
    dueDate: row.due_date ?? undefined,
    taskCreatedAt: row.task_created_at,
    completedAt: row.completed_at,
    completedByName: row.completed_by_name ?? undefined,
  };
}
