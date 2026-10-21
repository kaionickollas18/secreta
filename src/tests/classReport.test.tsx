import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));

const attendance = vi.hoisted(() => ({ classes: [] as import("../types/attendance").ClassData[] }));
vi.mock("../hooks/useAttendanceData", () => ({
  useAttendanceData: () => ({
    data: { generatedAt: "2026-10-20T12:00:00.000Z", classes: attendance.classes },
    status: "live",
    refreshing: false,
    refresh: async () => {},
  }),
}));

import { ClassDocument } from "../components/attendance/ClassDocument";
import FrequenciaApp from "../frequencia/FrequenciaApp";
import { useAuthStore } from "../store/authStore";
import { useSchoolStore } from "../store/schoolStore";
import type { ClassData, DayRecord } from "../types/attendance";
import { EMPTY_IDENTITY } from "../utils/schoolIdentity";
import { classReport, monthBars, niceMax, TOP_STUDENTS } from "../utils/classReport";
import { SECRETARY } from "./helpers";

// Turma fictícia: 12 alunos; "Aluno 01" falta mais, "Aluno 12" quase nada.
const NAMES = Array.from({ length: 12 }, (_, i) => `Aluno ${String(i + 1).padStart(2, "0")}`);
function makeClass(name: string): ClassData {
  const records: DayRecord[] = [];
  const dates = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-07", "2026-09-01", "2026-09-02", "2026-09-04", "2026-09-08"];
  dates.forEach((date, day) => {
    // O aluno i falta nos primeiros (12 - i) dias, limitado aos dias existentes.
    records.push({ date, absent: NAMES.filter((_, i) => day < Math.max(0, 8 - i)) });
  });
  return { name, records };
}
const CLASS = makeClass("6º ano A");

describe("relatório da turma (regras)", () => {
  const report = classReport(CLASS);

  it("resume a turma: dias, faltas, média, alunos e situação", () => {
    expect(report.schoolDays).toBe(8);
    expect([report.firstDate, report.lastDate]).toEqual(["2026-08-03", "2026-09-08"]);
    // Faltas por aluno: 8, 7, 6, 5, 4, 3, 2, 1 (os 4 últimos não faltam).
    expect(report.absences).toBe(36);
    expect(report.avgPerDay).toBeCloseTo(4.5);
    expect(report.studentsWithAbsence).toBe(8);
    expect(report.byRisk).toEqual({ critical: 6, warning: 1, ok: 1 });
    expect(report.busiestDay).toEqual({ date: "2026-08-03", absences: 8 });
    expect(report.insights.length).toBeLessThanOrEqual(4);
  });

  it("agrupa por mês e por dia da semana", () => {
    expect(report.months).toEqual([
      { month: "2026-08", schoolDays: 4, absences: 26, avgPerDay: 6.5, studentsAbsent: 8 },
      { month: "2026-09", schoolDays: 4, absences: 10, avgPerDay: 2.5, studentsAbsent: 4 },
    ]);
    expect(report.weekdays.map((w) => w.label)).toEqual(["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]);
  });

  it("lista os que mais faltam, com a última falta, no máximo 10", () => {
    expect(report.top[0]).toMatchObject({ name: "Aluno 01", absences: 8, lastAbsence: "2026-09-08", presenceRate: 0 });
    expect(report.top[7]).toMatchObject({ name: "Aluno 08", absences: 1, lastAbsence: "2026-08-03" });
    const big: ClassData = {
      name: "Grande",
      records: [{ date: "2026-08-03", absent: Array.from({ length: 25 }, (_, i) => `Pessoa ${i}`) }],
    };
    expect(classReport(big).top).toHaveLength(TOP_STUDENTS);
  });

  it("turma sem chamada não quebra", () => {
    const empty = classReport({ name: "Vazia", records: [] });
    expect(empty).toMatchObject({ schoolDays: 0, absences: 0, avgPerDay: 0, top: [], busiestDay: undefined });
  });
});

describe("gráfico de barras dos meses", () => {
  it("arredonda o topo da escala e usa passos redondos", () => {
    expect([niceMax(0), niceMax(0.7), niceMax(3.1), niceMax(6.5), niceMax(12)]).toEqual([1, 1, 5, 10, 20]);
    const chart = monthBars(classReport(CLASS).months);
    expect(chart.ticks.map((t) => t.value)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(chart.bars.map((b) => b.peak)).toEqual([true, false]);
    // Barra mais alta para a maior média, todas apoiadas na base.
    const [aug, sep] = chart.bars;
    expect((aug?.height ?? 0) > (sep?.height ?? 0)).toBe(true);
    expect((aug?.y ?? 0) + (aug?.height ?? 0)).toBeCloseTo(chart.baseline, 0);
  });
});

describe("relatório da turma (documento)", () => {
  it("tem o resumo na primeira página e os que mais faltam na segunda", () => {
    render(<ClassDocument report={classReport(CLASS)} identity={EMPTY_IDENTITY} issuedBy="Rita Lopes" issuedOn="2026-10-20" />);
    const doc = document.body.querySelector(".print-document");
    const text = doc?.textContent ?? "";
    expect(text).toContain("Relatório de Frequência da Turma");
    expect(text).toContain("6º ano A");
    expect(text).toContain("Período: agosto a setembro de 2026");
    expect(text).toContain("7 alunos pedem atenção");
    expect(text).toContain("Média de faltas por dia, mês a mês");
    expect(text).toContain("Faltas por dia da semana");
    // Segunda página começa numa folha nova, com a lista dos que mais faltam.
    const second = doc?.querySelector(".doc-page-break");
    expect(second?.textContent).toContain("Alunos com mais faltas");
    expect(second?.querySelectorAll("tbody tr")).toHaveLength(8);
    expect(second?.textContent).toContain("Emitido em 20/10/2026 por Rita Lopes.");
  });
});

describe("relatório da turma (Dashboard)", () => {
  const print = vi.fn();

  beforeEach(() => {
    attendance.classes = [CLASS, makeClass("7º ano B")];
    useAuthStore.setState({ status: "signedIn", profile: SECRETARY, error: null });
    useSchoolStore.setState({ identity: EMPTY_IDENTITY, status: "ready", load: async () => {} });
    print.mockReset();
    window.print = print;
  });

  it("escolher a turma mostra o botão; baixar imprime só o relatório dela e depois o retira", async () => {
    const user = userEvent.setup();
    render(<FrequenciaApp />);
    expect(screen.queryByRole("button", { name: "Baixar relatório da turma" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filtrar por turma"), "7º ano B");
    await user.click(screen.getByRole("button", { name: "Baixar relatório da turma" }));

    expect(print).toHaveBeenCalledTimes(1);
    const docs = document.body.querySelectorAll(".print-document");
    expect(docs).toHaveLength(1);
    expect(docs[0]?.textContent).toContain("7º ano B");

    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(document.body.querySelectorAll(".print-document")).toHaveLength(0);
  });

  it("cada turma do resumo tem o seu botão de PDF", async () => {
    const user = userEvent.setup();
    render(<FrequenciaApp />);
    const summary = within(screen.getByRole("region", { name: "Resumo por turma" }));
    await user.click(summary.getByRole("button", { name: "Baixar relatório da turma 6º ano A" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector(".print-document")?.textContent).toContain("6º ano A");
  });
});
