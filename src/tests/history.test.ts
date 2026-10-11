import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "../types/task";
import {
  CSV_BOM,
  csvCell,
  historyFileName,
  historyToCsv,
  periodLabel,
  periodStart,
} from "../utils/history";

const entry: HistoryEntry = {
  id: "h1",
  title: "Matrículas; turma A",
  description: 'Conferir "pendências"',
  priority: "high",
  assigneeNames: ["Ana Souza", "Rita Lopes"],
  dueDate: "2026-01-25",
  taskCreatedAt: "2026-01-10T10:00:00.000Z",
  completedAt: "2026-01-20T15:30:00.000Z",
  completedByName: "Rita Lopes",
};

describe("histórico", () => {
  it("calcula o início do período", () => {
    const now = new Date("2026-03-31T12:00:00.000Z");
    expect(periodStart(30, now)).toBe("2026-03-01T12:00:00.000Z");
    expect(periodStart(0, now)).toBeUndefined();
    expect(periodLabel(30)).toBe("Últimos 30 dias");
    expect(periodLabel(0)).toBe("Todo o histórico");
  });

  it("nomeia o arquivo com período e data", () => {
    const now = new Date(2026, 2, 31);
    expect(historyFileName(30, now)).toBe("historico-tarefas-30-dias-2026-03-31.csv");
    expect(historyFileName(0, now)).toBe("historico-tarefas-completo-2026-03-31.csv");
  });

  it("escapa separador, aspas e quebras de linha", () => {
    expect(csvCell("simples")).toBe("simples");
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });

  it("neutraliza valores que o Excel trataria como fórmula", () => {
    expect(csvCell("=SOMA(A1:A9)")).toBe("'=SOMA(A1:A9)");
    expect(csvCell("+55 11")).toBe("'+55 11");
    expect(csvCell("@fulano")).toBe("'@fulano");
    expect(csvCell("-1")).toBe("'-1");
  });

  it("gera CSV com BOM, cabeçalho e uma linha por tarefa", () => {
    const csv = historyToCsv([entry]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const [header, line, rest] = csv.slice(1).split("\r\n");
    expect(header).toBe(
      "Tarefa;Descrição;Prioridade;Responsáveis;Vencimento;Criada em;Concluída em;Concluída por",
    );
    expect(line).toContain('"Matrículas; turma A";"Conferir ""pendências""";Alta;Ana Souza, Rita Lopes;25/01/2026;');
    expect(line?.endsWith(";Rita Lopes")).toBe(true);
    expect(rest).toBe("");
  });

  it("gera só o cabeçalho quando não há tarefas", () => {
    expect(historyToCsv([]).slice(1).split("\r\n")).toHaveLength(2);
  });
});
