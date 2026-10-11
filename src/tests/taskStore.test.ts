import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/taskApi", () => import("./fakeTaskApi"));

import { useTaskStore } from "../store/taskStore";
import type { TaskInput } from "../types/task";
import { db, resetDb } from "./fakeTaskApi";
import { makeTask } from "./helpers";

const input: TaskInput = { title: "Nova", status: "todo", priority: "medium", assignees: [] };
const store = () => useTaskStore.getState();

describe("taskStore", () => {
  beforeEach(() => {
    resetDb();
    useTaskStore.setState({ tasks: [], status: "idle" });
  });

  it("carrega as tarefas em ordem de posição", async () => {
    db.tasks = [makeTask({ title: "B", position: 2 }), makeTask({ title: "A", position: 1 })];
    await store().load();
    expect(store().status).toBe("ready");
    expect(store().tasks.map((t) => t.title)).toEqual(["A", "B"]);
  });

  it("sinaliza erro quando não consegue carregar", async () => {
    db.failNext = "falhou";
    await store().load();
    expect(store().status).toBe("error");
  });

  it("cria, edita e exclui tarefas", async () => {
    expect(await store().addTask(input, "school-1")).toBeNull();
    const task = store().tasks[0];
    expect(task?.title).toBe("Nova");
    if (!task) return;

    const edited = await store().updateTask(
      task.id,
      { ...input, title: "Editada", priority: "urgent", assignees: ["ana"] },
      "secretary",
    );
    expect(edited.error).toBeNull();
    expect(store().tasks[0]).toMatchObject({ title: "Editada", priority: "urgent", assignees: ["ana"] });

    expect(await store().deleteTask(task.id)).toBeNull();
    expect(store().tasks).toHaveLength(0);
  });

  it("devolve a mensagem de erro do banco e não altera a lista", async () => {
    db.failNext = "Somente o secretário cria tarefas.";
    expect(await store().addTask(input, "school-1")).toBe("Somente o secretário cria tarefas.");
    expect(store().tasks).toHaveLength(0);
  });

  it("o auxiliar não altera responsáveis ao editar", async () => {
    db.tasks = [makeTask({ id: "t1", assignees: ["beto"] })];
    await store().load();
    await store().updateTask("t1", { ...input, title: "Ajustada", assignees: ["ana"] }, "assistant");
    expect(store().tasks[0]).toMatchObject({ title: "Ajustada", assignees: ["beto"] });
  });

  it("auxiliar que arrasta para Concluído gera pedido em Em Revisão", async () => {
    db.tasks = [makeTask({ id: "t1", status: "in_progress" })];
    await store().load();
    const result = await store().moveTask("t1", "done", undefined, "assistant");
    expect(result).toEqual({ error: null, outcome: "requested" });
    expect(store().tasks[0]).toMatchObject({ status: "review", completionRequested: true });
  });

  it("auxiliar não reabre tarefa concluída", async () => {
    db.tasks = [makeTask({ id: "t1", status: "done" })];
    await store().load();
    const result = await store().moveTask("t1", "todo", undefined, "assistant");
    expect(result.outcome).toBe("blocked");
    expect(result.error).toContain("secretário");
    expect(store().tasks[0]?.status).toBe("done");
  });

  it("secretário aprova e devolve pedidos", async () => {
    db.tasks = [
      makeTask({ id: "a", status: "review", completionRequested: true }),
      makeTask({ id: "b", status: "review", completionRequested: true }),
    ];
    await store().load();
    expect(await store().respondCompletion("a", true)).toBeNull();
    expect(await store().respondCompletion("b", false)).toBeNull();
    const byId = Object.fromEntries(store().tasks.map((t) => [t.id, t]));
    expect(byId.a).toMatchObject({ status: "done", completionRequested: false });
    expect(byId.b).toMatchObject({ status: "review", completionRequested: false });
  });

  it("reordena dentro da coluna e salva a nova posição", async () => {
    db.tasks = [
      makeTask({ id: "a", position: 1 }),
      makeTask({ id: "b", position: 2 }),
      makeTask({ id: "c", position: 3 }),
    ];
    await store().load();
    await store().moveTask("c", "todo", "a", "secretary");
    expect(store().tasks.map((t) => t.id)).toEqual(["c", "a", "b"]);
    expect(db.tasks.find((t) => t.id === "c")?.position).toBeLessThan(1);
  });

  it("desfaz o movimento quando o banco recusa", async () => {
    db.tasks = [makeTask({ id: "t1", status: "todo" })];
    await store().load();
    db.failNext = "Sem permissão.";
    const result = await store().moveTask("t1", "review", undefined, "secretary");
    expect(result.error).toBe("Sem permissão.");
    expect(store().tasks[0]?.status).toBe("todo");
  });
});
