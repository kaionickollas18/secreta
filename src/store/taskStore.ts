import { create } from "zustand";
import type { UserRole } from "../types/auth";
import type { Task, TaskInput, TaskPriority, TaskStatus } from "../types/task";
import { canManageTasks } from "../utils/roles";
import { inputToRow } from "../utils/taskRows";
import {
  moveTask as moveTaskInList,
  nextPosition,
  positionFor,
  resolveStatusChange,
  sortBoard,
  type StatusChange,
} from "../utils/tasks";
import { fetchTasks, insertTask, patchTask, removeTask, subscribeTasks } from "./taskApi";

const BLOCKED = "Somente o secretário reabre uma tarefa concluída.";

export interface ChangeResult {
  /** Mensagem de erro, ou `null` se deu certo. */
  error: string | null;
  outcome: StatusChange["outcome"];
}

interface TaskState {
  tasks: Task[];
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
  /** Recarrega quando outra pessoa altera o quadro. Devolve como parar. */
  watch: () => () => void;
  addTask: (input: TaskInput, schoolId: string) => Promise<string | null>;
  updateTask: (id: string, input: TaskInput, role: UserRole) => Promise<ChangeResult>;
  setPriority: (id: string, priority: TaskPriority) => Promise<string | null>;
  deleteTask: (id: string) => Promise<string | null>;
  moveTask: (
    id: string,
    status: TaskStatus,
    overId: string | undefined,
    role: UserRole,
  ) => Promise<ChangeResult>;
  /** Secretário aprova (conclui) ou devolve um pedido de conclusão. */
  respondCompletion: (id: string, approve: boolean) => Promise<string | null>;
}

export const useTaskStore = create<TaskState>((set, get) => {
  const replace = (task: Task) =>
    set((s) => ({ tasks: sortBoard(s.tasks.map((t) => (t.id === task.id ? task : t))) }));

  /** Salva o patch e troca a tarefa pela versão do banco. */
  async function save(id: string, patch: Record<string, unknown>): Promise<string | null> {
    const result = await patchTask(id, patch);
    if (result.error !== null) return result.error;
    replace(result.data);
    return null;
  }

  return {
    tasks: [],
    status: "idle",

    load: async () => {
      set((s) => ({ status: s.status === "ready" ? "ready" : "loading" }));
      const result = await fetchTasks();
      if (result.error !== null) return set({ status: "error" });
      set({ status: "ready", tasks: sortBoard(result.data) });
    },

    watch: () => subscribeTasks(() => void get().load()),

    addTask: async (input, schoolId) => {
      const result = await insertTask(schoolId, input, nextPosition(get().tasks));
      if (result.error !== null) return result.error;
      const task = result.data;
      set((s) => ({ tasks: sortBoard([...s.tasks.filter((t) => t.id !== task.id), task]) }));
      return null;
    },

    updateTask: async (id, input, role) => {
      const task = get().tasks.find((t) => t.id === id);
      if (!task) return { error: "Tarefa não encontrada.", outcome: "unchanged" };
      const change = resolveStatusChange(task, input.status, role);
      if (change.outcome === "blocked") return { error: BLOCKED, outcome: "blocked" };

      const row = inputToRow({ ...input, status: change.status });
      // Só o Secretário altera responsáveis; o Assistente envia os demais campos.
      const { assignee_ids, ...withoutAssignees } = row;
      const patch = {
        ...(canManageTasks(role) ? { ...withoutAssignees, assignee_ids } : withoutAssignees),
        completion_requested: change.completionRequested,
      };
      return { error: await save(id, patch), outcome: change.outcome };
    },

    setPriority: (id, priority) => save(id, { priority }),

    deleteTask: async (id) => {
      const error = await removeTask(id);
      if (!error) set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
      return error;
    },

    moveTask: async (id, toStatus, overId, role) => {
      const before = get().tasks;
      const task = before.find((t) => t.id === id);
      if (!task) return { error: null, outcome: "unchanged" };
      const change = resolveStatusChange(task, toStatus, role);
      if (change.outcome === "blocked") return { error: BLOCKED, outcome: "blocked" };

      // Se a coluna final não é a que o usuário apontou (pedido de conclusão), vai para o fim dela.
      const target = change.status === toStatus ? overId : undefined;
      const reordered = moveTaskInList(before, id, change.status, target);
      const position = positionFor(reordered, id);
      const unchanged =
        change.outcome === "unchanged" && (reordered === before || position === task.position);
      if (unchanged) return { error: null, outcome: "unchanged" };

      // Atualização otimista: o cartão muda na hora e volta atrás se o banco recusar.
      set({
        // Reordena já aqui: se a pessoa soltou o cartão fora do grupo da prioridade dele,
        // ele aparece direto no lugar certo, sem "pular" depois que o banco responde.
        tasks: sortBoard(
          reordered.map((t) =>
            t.id === id
              ? { ...t, position, completionRequested: change.completionRequested }
              : t,
          ),
        ),
      });
      const error = await save(id, {
        status: change.status,
        completion_requested: change.completionRequested,
        position,
      });
      if (error) {
        set({ tasks: before });
        void get().load();
      }
      return { error, outcome: change.outcome };
    },

    respondCompletion: (id, approve) =>
      save(id, approve ? { status: "done" } : { completion_requested: false }),
  };
});
