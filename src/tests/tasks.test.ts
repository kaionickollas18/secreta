import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterTasks, groupByStatus, moveTask } from "../utils/tasks";
import { makeTask } from "./helpers";

describe("filterTasks", () => {
  const tasks = [
    makeTask({ id: "a", title: "Revisão do relatório", priority: "high" }),
    makeTask({ id: "b", title: "Comprar café", description: "Para o escritório", priority: "low" }),
    makeTask({ id: "c", title: "Pagar boleto", dueDate: "2026-10-01", status: "todo" }),
    makeTask({ id: "d", title: "Enviar nota", dueDate: "2026-10-01", status: "done" }),
  ];
  const today = "2026-10-06";

  it("busca ignorando acentos e maiúsculas, em título e descrição", () => {
    const byTitle = filterTasks(tasks, { ...DEFAULT_FILTERS, query: "REVISAO" }, today);
    expect(byTitle.map((t) => t.id)).toEqual(["a"]);
    const byDescription = filterTasks(tasks, { ...DEFAULT_FILTERS, query: "escritorio" }, today);
    expect(byDescription.map((t) => t.id)).toEqual(["b"]);
  });

  it("filtra por prioridade", () => {
    const result = filterTasks(tasks, { ...DEFAULT_FILTERS, priority: "low" }, today);
    expect(result.map((t) => t.id)).toEqual(["b"]);
  });

  it("filtra atrasadas e ignora tarefas concluídas", () => {
    const result = filterTasks(tasks, { ...DEFAULT_FILTERS, overdueOnly: true }, today);
    expect(result.map((t) => t.id)).toEqual(["c"]);
  });

  it("sem filtros devolve tudo", () => {
    expect(filterTasks(tasks, DEFAULT_FILTERS, today)).toHaveLength(4);
  });
});

describe("groupByStatus", () => {
  it("agrupa por coluna mantendo a ordem e inclui colunas vazias", () => {
    const list = [
      makeTask({ id: "1", status: "todo" }),
      makeTask({ id: "2", status: "done" }),
      makeTask({ id: "3", status: "todo" }),
    ];
    const grouped = groupByStatus(list);
    expect(grouped.todo.map((t) => t.id)).toEqual(["1", "3"]);
    expect(grouped.done.map((t) => t.id)).toEqual(["2"]);
    expect(Object.keys(grouped)).toEqual(["todo", "in_progress", "review", "done"]);
  });
});

describe("moveTask", () => {
  const make = () => [
    makeTask({ id: "a", status: "todo" }),
    makeTask({ id: "b", status: "todo" }),
    makeTask({ id: "c", status: "todo" }),
    makeTask({ id: "x", status: "done" }),
  ];
  const ids = (list: ReturnType<typeof make>, status: string) =>
    list.filter((t) => t.status === status).map((t) => t.id);

  it("move para o fim de outra coluna e atualiza updatedAt", () => {
    const result = moveTask(make(), "a", "done", undefined, "2026-10-06T00:00:00.000Z");
    expect(ids(result, "done")).toEqual(["x", "a"]);
    expect(result.find((t) => t.id === "a")?.updatedAt).toBe("2026-10-06T00:00:00.000Z");
  });

  it("entra antes da tarefa alvo em outra coluna", () => {
    const result = moveTask(make(), "a", "done", "x");
    expect(ids(result, "done")).toEqual(["a", "x"]);
  });

  it("reordena para baixo na mesma coluna", () => {
    expect(ids(moveTask(make(), "a", "todo", "c"), "todo")).toEqual(["b", "c", "a"]);
  });

  it("reordena para cima na mesma coluna", () => {
    expect(ids(moveTask(make(), "c", "todo", "a"), "todo")).toEqual(["c", "a", "b"]);
  });

  it("ignora ids inexistentes e soltar sobre si mesma", () => {
    const list = make();
    expect(moveTask(list, "nope", "done")).toBe(list);
    expect(moveTask(list, "a", "done", "nope")).toBe(list);
    expect(moveTask(list, "a", "todo", "a")).toBe(list);
  });
});
