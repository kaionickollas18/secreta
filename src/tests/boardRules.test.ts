import { describe, expect, it } from "vitest";
import type { TaskFormValues } from "../types/task";
import { assignableMembers, assigneeColor } from "../utils/assignees";
import {
  DEFAULT_FILTERS,
  filterTasks,
  nextPosition,
  positionFor,
  PRIORITY_RANK,
  resolveStatusChange,
  sortBoard,
} from "../utils/tasks";
import { taskFromRow, type TaskRow } from "../utils/taskRows";
import { validateTaskForm } from "../utils/validation";
import { makeMember, makeTask, TEAM } from "./helpers";

describe("regra de conclusão (resolveStatusChange)", () => {
  const open = { status: "in_progress", completionRequested: false } as const;

  it("secretário move para qualquer coluna e encerra pedidos", () => {
    expect(resolveStatusChange(open, "done", "secretary")).toEqual({
      status: "done",
      completionRequested: false,
      outcome: "moved",
    });
    expect(
      resolveStatusChange({ status: "review", completionRequested: true }, "todo", "secretary"),
    ).toEqual({ status: "todo", completionRequested: false, outcome: "moved" });
    expect(resolveStatusChange({ status: "done", completionRequested: false }, "todo", "secretary").outcome).toBe(
      "moved",
    );
  });

  it("assistente que tenta concluir gera pedido em Em Revisão", () => {
    expect(resolveStatusChange(open, "done", "assistant")).toEqual({
      status: "review",
      completionRequested: true,
      outcome: "requested",
    });
  });

  it("assistente não repete um pedido já feito", () => {
    expect(
      resolveStatusChange({ status: "review", completionRequested: true }, "done", "assistant").outcome,
    ).toBe("unchanged");
  });

  it("assistente não reabre tarefa concluída", () => {
    const done = { status: "done", completionRequested: false } as const;
    expect(resolveStatusChange(done, "todo", "assistant")).toEqual({ ...done, outcome: "blocked" });
  });

  it("assistente que tira a tarefa da coluna cancela o pedido", () => {
    expect(
      resolveStatusChange({ status: "review", completionRequested: true }, "in_progress", "assistant"),
    ).toEqual({ status: "in_progress", completionRequested: false, outcome: "moved" });
  });

  it("o Master nunca conclui pelo quadro", () => {
    expect(resolveStatusChange(open, "done", "master").outcome).toBe("requested");
  });
});

describe("posição dos cartões", () => {
  const a = makeTask({ id: "a", position: 1 });
  const b = makeTask({ id: "b", position: 2 });
  const other = makeTask({ id: "x", status: "review", position: 1.5 });

  it("fica no meio das vizinhas da mesma coluna, ignorando outras colunas", () => {
    const moved = makeTask({ id: "m", position: 9 });
    expect(positionFor([a, other, moved, b], "m")).toBe(1.5);
  });

  it("nas pontas usa ±1; sozinha mantém a posição", () => {
    const moved = makeTask({ id: "m", position: 9 });
    expect(positionFor([moved, a, b], "m")).toBe(0);
    expect(positionFor([a, b, moved], "m")).toBe(3);
    expect(positionFor([other, moved], "m")).toBe(9);
  });

  it("a prioridade mais alta fica em cima; na mesma prioridade, vale a posição", () => {
    const list = [
      makeTask({ id: "baixa", priority: "low", position: 1 }),
      makeTask({ id: "urgente-2", priority: "urgent", position: 9 }),
      makeTask({ id: "media", priority: "medium", position: 2 }),
      makeTask({ id: "alta", priority: "high", position: 5 }),
      makeTask({ id: "urgente-1", priority: "urgent", position: 3 }),
    ];
    expect(sortBoard(list).map((t) => t.id)).toEqual(["urgente-1", "urgente-2", "alta", "media", "baixa"]);
    expect(PRIORITY_RANK).toEqual({ low: 0, medium: 1, high: 2, urgent: 3 });
  });

  it("ao reordenar, só as vizinhas de mesma prioridade definem a posição", () => {
    const urgent = makeTask({ id: "u", priority: "urgent", position: 1 });
    const m1 = makeTask({ id: "m1", priority: "medium", position: 4 });
    const m2 = makeTask({ id: "m2", priority: "medium", position: 6 });
    const moved = makeTask({ id: "m", priority: "medium", position: 9 });
    // Solta entre as duas médias: fica no meio delas.
    expect(positionFor([urgent, m1, moved, m2], "m")).toBe(5);
    // Solta acima da urgente: a urgente não conta; vai para antes da primeira média.
    expect(positionFor([moved, urgent, m1, m2], "m")).toBe(3);
    // Única da sua prioridade na coluna: mantém a posição (arrastar não muda nada).
    expect(positionFor([moved, urgent], "m")).toBe(9);
  });

  it("ordena por posição e calcula a próxima", () => {
    expect(sortBoard([b, a]).map((t) => t.id)).toEqual(["a", "b"]);
    expect(nextPosition([a, b])).toBe(3);
    expect(nextPosition([])).toBe(1);
  });
});

describe("responsáveis", () => {
  const form: TaskFormValues = {
    title: "Emitir histórico",
    description: "",
    status: "todo",
    priority: "medium",
    assignees: [],
    dueDate: "",
  };

  it("são o secretário (primeiro) e os assistentes ativos, por sobrenome", () => {
    const members = [
      ...TEAM,
      makeMember({ id: "off", fullName: "Caio Alves", active: false }),
      makeMember({ id: "m", fullName: "Kaio Ribeiro", role: "master", schoolId: null }),
    ];
    expect(assignableMembers(members).map((m) => m.lastName)).toEqual(["Lopes", "Dias", "Souza"]);
  });

  it("a cor de cada pessoa é estável", () => {
    expect(assigneeColor("ana")).toBe(assigneeColor("ana"));
  });

  it("valida: remove duplicados, limita a 3 e rejeita quem não é da equipe", () => {
    const ids = ["sec", "ana", "beto", "extra"];
    const ok = validateTaskForm({ ...form, assignees: ["ana", "ana", "sec"] }, ids);
    expect(ok.valid && ok.value.assignees).toEqual(["ana", "sec"]);
    expect(validateTaskForm({ ...form, assignees: ids }, ids).valid).toBe(false);
    expect(validateTaskForm({ ...form, assignees: ["fulano"] }, ids).valid).toBe(false);
  });

  it("filtra por responsável, sem responsável e busca por @sobrenome", () => {
    const t1 = makeTask({ assignees: ["ana"] });
    const t2 = makeTask({ assignees: ["beto", "ana"] });
    const t3 = makeTask();
    const tasks = [t1, t2, t3];
    const nameOf = (id: string) => TEAM.find((m) => m.id === id)?.lastName ?? "";

    expect(filterTasks(tasks, { ...DEFAULT_FILTERS, assignee: "ana" })).toEqual([t1, t2]);
    expect(filterTasks(tasks, { ...DEFAULT_FILTERS, assignee: "beto" })).toEqual([t2]);
    expect(filterTasks(tasks, { ...DEFAULT_FILTERS, assignee: "none" })).toEqual([t3]);
    expect(filterTasks(tasks, { ...DEFAULT_FILTERS, query: "@Dias" }, undefined, nameOf)).toEqual([t2]);
  });
});

describe("taskFromRow", () => {
  const row: TaskRow = {
    id: "1",
    title: "T",
    description: null,
    status: "review",
    priority: "high",
    assignee_ids: null,
    due_date: null,
    completion_requested: true,
    position: 4,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    completed_at: null,
  };

  it("converte a linha do banco", () => {
    expect(taskFromRow(row)).toMatchObject({
      status: "review",
      completedAt: undefined,
      assignees: [],
      description: undefined,
      dueDate: undefined,
      completionRequested: true,
      position: 4,
    });
  });

  it("ignora linhas com status ou prioridade desconhecidos", () => {
    expect(taskFromRow({ ...row, status: "arquivada" })).toBeNull();
    expect(taskFromRow({ ...row, priority: "máxima" })).toBeNull();
  });
});
