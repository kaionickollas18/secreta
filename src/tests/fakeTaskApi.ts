import type { ApiResult } from "../store/taskApi";
import type { HistoryEntry, Task, TaskInput } from "../types/task";

/** Substituto em memória de `store/taskApi` para os testes (sem rede). */
export const db: { tasks: Task[]; history: HistoryEntry[]; failNext: string | null } = {
  tasks: [],
  history: [],
  failNext: null,
};

let created = 0;

export function resetDb() {
  db.tasks = [];
  db.history = [];
  db.failNext = null;
  created = 0;
}

function takeFailure(): string | null {
  const error = db.failNext;
  db.failNext = null;
  return error;
}

const NOW = "2026-02-01T12:00:00.000Z";

export async function fetchTasks(): Promise<ApiResult<Task[]>> {
  const error = takeFailure();
  return error ? { data: null, error } : { data: [...db.tasks], error: null };
}

export async function insertTask(
  _schoolId: string,
  input: TaskInput,
  position: number,
): Promise<ApiResult<Task>> {
  const error = takeFailure();
  if (error) return { data: null, error };
  created += 1;
  const task: Task = {
    id: `new-${created}`,
    ...input,
    completionRequested: false,
    position,
    createdAt: NOW,
    updatedAt: NOW,
  };
  db.tasks.push(task);
  return { data: task, error: null };
}

export async function patchTask(
  id: string,
  patch: Record<string, unknown>,
): Promise<ApiResult<Task>> {
  const error = takeFailure();
  if (error) return { data: null, error };
  const current = db.tasks.find((t) => t.id === id);
  if (!current) return { data: null, error: "Tarefa não encontrada." };
  const next: Task = { ...current, updatedAt: NOW };
  if ("title" in patch) next.title = patch.title as string;
  if ("description" in patch) next.description = (patch.description as string | null) ?? undefined;
  if ("status" in patch) next.status = patch.status as Task["status"];
  if ("priority" in patch) next.priority = patch.priority as Task["priority"];
  if ("assignee_ids" in patch) next.assignees = patch.assignee_ids as string[];
  if ("due_date" in patch) next.dueDate = (patch.due_date as string | null) ?? undefined;
  if ("completion_requested" in patch) next.completionRequested = patch.completion_requested as boolean;
  if ("position" in patch) next.position = patch.position as number;
  // Como o banco: concluir encerra o pedido pendente.
  if (next.status === "done") next.completionRequested = false;
  db.tasks = db.tasks.map((t) => (t.id === id ? next : t));
  return { data: next, error: null };
}

export async function removeTask(id: string): Promise<string | null> {
  const error = takeFailure();
  if (error) return error;
  db.tasks = db.tasks.filter((t) => t.id !== id);
  return null;
}

export function subscribeTasks(): () => void {
  return () => {};
}

export async function fetchHistory(): Promise<ApiResult<HistoryEntry[]>> {
  const error = takeFailure();
  return error ? { data: null, error } : { data: [...db.history], error: null };
}
