import type { HistoryEntry, Task, TaskInput } from "../types/task";
import {
  HISTORY_COLUMNS,
  historyFromRow,
  inputToRow,
  TASK_COLUMNS,
  taskFromRow,
  type HistoryRow,
  type TaskRow,
} from "../utils/taskRows";
import { supabase } from "./supabaseClient";

/** Acesso às tabelas `tasks` e `task_history`. Isolado aqui para o store ser testável sem rede. */

export type ApiResult<T> = { data: T; error: null } | { data: null; error: string };

const GENERIC_ERROR = "Não foi possível salvar. Verifique sua conexão e tente de novo.";
const fail = (error: string = GENERIC_ERROR) => ({ data: null, error });

/** Erros `P0001` vêm das regras do banco, já escritos em português para o usuário. */
function messageOf(error: { code?: string; message: string }): string {
  return error.code === "P0001" ? error.message : GENERIC_ERROR;
}

export async function fetchTasks(): Promise<ApiResult<Task[]>> {
  if (!supabase) return fail();
  const { data, error } = await supabase.from("tasks").select(TASK_COLUMNS);
  if (error) return fail("Não foi possível carregar as tarefas.");
  const tasks = (data as TaskRow[]).flatMap((row) => taskFromRow(row) ?? []);
  return { data: tasks, error: null };
}

export async function insertTask(
  schoolId: string,
  input: TaskInput,
  position: number,
): Promise<ApiResult<Task>> {
  if (!supabase) return fail();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...inputToRow(input), school_id: schoolId, position })
    .select(TASK_COLUMNS)
    .single();
  if (error) return fail(messageOf(error));
  const task = taskFromRow(data as TaskRow);
  return task ? { data: task, error: null } : fail();
}

export async function patchTask(
  id: string,
  patch: Record<string, unknown>,
): Promise<ApiResult<Task>> {
  if (!supabase) return fail();
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select(TASK_COLUMNS)
    .single();
  if (error) return fail(messageOf(error));
  const task = taskFromRow(data as TaskRow);
  return task ? { data: task, error: null } : fail();
}

export async function removeTask(id: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  return error ? messageOf(error) : null;
}

/** Avisa quando qualquer tarefa da escola muda (outra pessoa editou). Devolve como parar. */
export function subscribeTasks(onChange: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel("tasks-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
    .subscribe();
  return () => void client.removeChannel(channel);
}

/** Tarefas concluídas a partir de `since` (ISO), mais recentes primeiro. Sem `since`: tudo. */
export async function fetchHistory(since?: string): Promise<ApiResult<HistoryEntry[]>> {
  if (!supabase) return fail();
  let query = supabase
    .from("task_history")
    .select(HISTORY_COLUMNS)
    .order("completed_at", { ascending: false });
  if (since) query = query.gte("completed_at", since);
  const { data, error } = await query;
  if (error) return fail("Não foi possível carregar o histórico.");
  return { data: (data as HistoryRow[]).map(historyFromRow), error: null };
}
