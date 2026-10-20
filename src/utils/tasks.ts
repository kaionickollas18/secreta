import type { UserRole } from "../types/auth";
import {
  TASK_STATUSES,
  type Task,
  type TaskFilters,
  type TaskPriority,
  type TaskStatus,
} from "../types/task";
import { isOverdue, todayISO } from "./date";
import { canApproveCompletion } from "./roles";

export const DEFAULT_FILTERS: TaskFilters = {
  query: "",
  priority: "all",
  assignee: "all",
  overdueOnly: false,
};

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.priority !== "all" ||
    filters.assignee !== "all" ||
    filters.overdueOnly
  );
}

/** Minúsculas e sem acentos, para buscas tolerantes. */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** `nameOf` devolve o nome exibido de um responsável, para a busca encontrar por nome. */
export function filterTasks(
  tasks: Task[],
  filters: TaskFilters,
  today: string = todayISO(),
  nameOf: (id: string) => string = () => "",
): Task[] {
  // "@ribeiro" e "ribeiro" encontram as mesmas tarefas.
  const query = normalizeText(filters.query.trim().replace(/^@/, ""));
  return tasks.filter((task) => {
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (filters.assignee === "none" && task.assignees.length > 0) return false;
    if (
      filters.assignee !== "all" &&
      filters.assignee !== "none" &&
      !task.assignees.includes(filters.assignee)
    )
      return false;
    if (filters.overdueOnly && !isOverdue(task.dueDate, task.status, today)) return false;
    if (query) {
      const names = task.assignees.map(nameOf).join(" ");
      const haystack = normalizeText(`${task.title} ${task.description ?? ""} ${names}`);
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const grouped = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as Task[]])) as Record<
    TaskStatus,
    Task[]
  >;
  for (const task of tasks) grouped[task.status].push(task);
  return grouped;
}

/** Peso de cada prioridade na ordem do quadro: baixa 0, média 1, alta 2, urgente 3. */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

/**
 * Ordem do quadro: a prioridade mais alta fica em cima. Entre tarefas de mesma prioridade,
 * vale a posição escolhida ao arrastar; no empate, a mais antiga primeiro.
 */
export function sortBoard(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
      a.position - b.position ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

/** Posição para uma tarefa nova: depois de todas as existentes. */
export function nextPosition(tasks: Task[]): number {
  return tasks.reduce((max, t) => Math.max(max, t.position), 0) + 1;
}

/**
 * Move uma tarefa para outra coluna e/ou posição.
 * - Sem `overId`: vai para o fim da coluna de destino.
 * - Com `overId`: ocupa a posição da tarefa alvo (mesma coluna: segue a direção do arraste;
 *   outra coluna: entra antes da tarefa alvo).
 * A ordem de cada coluna é a ordem relativa das tarefas no array.
 */
export function moveTask(
  tasks: Task[],
  id: string,
  toStatus: TaskStatus,
  overId?: string,
  now: string = new Date().toISOString(),
): Task[] {
  const fromIndex = tasks.findIndex((t) => t.id === id);
  if (fromIndex === -1 || overId === id) return tasks;
  const task = tasks[fromIndex] as Task;
  const moved: Task =
    task.status === toStatus ? task : { ...task, status: toStatus, updatedAt: now };
  const rest = tasks.filter((t) => t.id !== id);

  if (!overId) return [...rest, moved];

  const overIndex = tasks.findIndex((t) => t.id === overId);
  if (overIndex === -1) return tasks;
  const overTask = tasks[overIndex] as Task;
  const restOverIndex = rest.findIndex((t) => t.id === overId);
  const sameColumn = overTask.status === task.status;
  const insertAt = sameColumn && fromIndex < overIndex ? restOverIndex + 1 : restOverIndex;
  return [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)];
}

/**
 * Posição a salvar para a tarefa `id` depois de reordenada em `tasks`: o meio entre as
 * vizinhas da mesma coluna e da mesma prioridade (ou ±1 quando está em uma ponta).
 * Vizinhas de outra prioridade não contam: a prioridade sempre vem antes da posição, então
 * arrastar só reordena dentro do próprio grupo.
 */
export function positionFor(tasks: Task[], id: string): number {
  const index = tasks.findIndex((t) => t.id === id);
  const task = tasks[index];
  if (!task) return 0;
  const sameColumn = (t: Task) => t.status === task.status && t.priority === task.priority;
  const prev = tasks.slice(0, index).reverse().find(sameColumn);
  const next = tasks.slice(index + 1).find(sameColumn);
  if (prev && next) return (prev.position + next.position) / 2;
  if (prev) return prev.position + 1;
  if (next) return next.position - 1;
  return task.position;
}

export interface StatusChange {
  status: TaskStatus;
  completionRequested: boolean;
  /**
   * moved: mudou de coluna · requested: virou pedido de conclusão (auxiliar) ·
   * blocked: não permitido para o papel · unchanged: mesma coluna.
   */
  outcome: "moved" | "requested" | "blocked" | "unchanged";
}

/**
 * Regra de conclusão: só o Secretário conclui ou reabre. Quando o Auxiliar tenta concluir,
 * a tarefa vai para "Em Revisão" com o pedido de conclusão ligado.
 */
export function resolveStatusChange(
  task: Pick<Task, "status" | "completionRequested">,
  toStatus: TaskStatus,
  role: UserRole,
): StatusChange {
  const same = { status: task.status, completionRequested: task.completionRequested };
  if (canApproveCompletion(role)) {
    if (toStatus === task.status) return { ...same, outcome: "unchanged" };
    return { status: toStatus, completionRequested: false, outcome: "moved" };
  }
  if (task.status === "done") {
    return { ...same, outcome: toStatus === "done" ? "unchanged" : "blocked" };
  }
  if (toStatus === "done") {
    if (task.completionRequested && task.status === "review") return { ...same, outcome: "unchanged" };
    return { status: "review", completionRequested: true, outcome: "requested" };
  }
  if (toStatus === task.status) return { ...same, outcome: "unchanged" };
  // Sair da coluna cancela o pedido pendente.
  return { status: toStatus, completionRequested: false, outcome: "moved" };
}

/** Endereço que abre a tarefa no quadro (usado nas marcações `#` das conversas). */
export function taskHref(taskId: string): string {
  return `index.html?tarefa=${encodeURIComponent(taskId)}`;
}

/** Tarefa pedida no endereço (`?tarefa=<id>`), ou `null`. */
export function taskFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get("tarefa");
  return id && /^[\w-]{1,64}$/.test(id) ? id : null;
}

/** Dias que uma tarefa concluída continua visível no quadro. Depois, só no histórico. */
export const DONE_VISIBLE_DAYS = 3;

/**
 * A tarefa aparece no quadro? Concluídas saem depois de `DONE_VISIBLE_DAYS` dias; continuam
 * no banco e no histórico. Sem `completedAt` (conclusões antigas), vale a última edição.
 */
export function onBoard(task: Task, now: Date = new Date()): boolean {
  if (task.status !== "done") return true;
  const completed = Date.parse(task.completedAt ?? task.updatedAt);
  if (Number.isNaN(completed)) return true;
  return now.getTime() - completed < DONE_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
}

/** Tarefas não concluídas em que a pessoa é responsável, na ordem do quadro. */
export function openTasksOf(tasks: Task[], userId: string): Task[] {
  return sortBoard(tasks.filter((t) => t.status !== "done" && t.assignees.includes(userId)));
}
