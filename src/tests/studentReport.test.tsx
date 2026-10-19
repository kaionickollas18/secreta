import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StudentReportCard } from "../components/attendance/StudentReportCard";
import { StudentSearch } from "../components/attendance/StudentSearch";
import type { ClassData } from "../types/attendance";
import { monthLabel, searchStudents, studentReport, summarizeStudents } from "../utils/attendance";

const classes: ClassData[] = [
  {
    name: "5 ano A",
    records: [
      { date: "2026-05-28", absent: ["Ana Lúcia"] },
      { date: "2026-05-29", absent: [] },
      { date: "2026-06-01", absent: ["Ana Lúcia", "Bia"] },
      { date: "2026-06-02", absent: ["Ana Lúcia"] },
      { date: "2026-06-03", absent: [] },
      { date: "2026-06-04", absent: ["Ana Lúcia"] },
    ],
  },
  { name: "6 ano A", records: [{ date: "2026-06-01", absent: ["Ana Paula"] }] },
];

describe("studentReport", () => {
  it("resume o aluno e calcula a frequência de cada mês", () => {
    const report = studentReport(classes, "5 ano A", "Ana Lúcia");
    expect(report).toMatchObject({
      name: "Ana Lúcia",
      className: "5 ano A",
      absences: 4,
      schoolDays: 6,
      streak: 1,
      risk: "critical",
      lastAbsence: "2026-06-04",
      worstMonth: "2026-06",
    });
    expect(report?.presenceRate).toBeCloseTo(2 / 6);
    expect(report?.months).toEqual([
      {
        month: "2026-05",
        label: "Maio de 2026",
        schoolDays: 2,
        absences: 1,
        presenceRate: 0.5,
        risk: "critical",
        dates: ["2026-05-28"],
      },
      {
        month: "2026-06",
        label: "Junho de 2026",
        schoolDays: 4,
        absences: 3,
        presenceRate: 0.25,
        risk: "critical",
        dates: ["2026-06-01", "2026-06-02", "2026-06-04"],
      },
    ]);
  });

  it("mês sem falta conta como 100% e não é o pior mês", () => {
    const report = studentReport(classes, "5 ano A", "Bia");
    expect(report?.months.map((m) => [m.month, m.presenceRate, m.risk])).toEqual([
      ["2026-05", 1, "ok"],
      ["2026-06", 0.75, "warning"],
    ]);
    expect(report?.worstMonth).toBe("2026-06");
  });

  it("devolve null para aluno ou turma que não existem nos dados", () => {
    expect(studentReport(classes, "5 ano A", "Caio")).toBeNull();
    expect(studentReport(classes, "9 ano Z", "Bia")).toBeNull();
  });

  it("formata o nome do mês", () => {
    expect(monthLabel("2026-01")).toBe("Janeiro de 2026");
    expect(monthLabel("2026-12")).toBe("Dezembro de 2026");
  });
});

describe("searchStudents", () => {
  const students = summarizeStudents(classes);

  it("busca sem acento nem caixa, em todas as turmas, em ordem alfabética", () => {
    expect(searchStudents(students, "ana").map((s) => `${s.name} (${s.className})`)).toEqual([
      "Ana Lúcia (5 ano A)",
      "Ana Paula (6 ano A)",
    ]);
    expect(searchStudents(students, "LUCIA").map((s) => s.name)).toEqual(["Ana Lúcia"]);
  });

  it("texto vazio não lista ninguém e o limite é respeitado", () => {
    expect(searchStudents(students, "  ")).toEqual([]);
    expect(searchStudents(students, "a", 1)).toHaveLength(1);
  });
});

describe("pesquisa e resumo na tela", () => {
  it("lista os alunos encontrados e avisa quando não há resultado", async () => {
    const onSelect = vi.fn();
    render(<StudentSearch students={summarizeStudents(classes)} onSelect={onSelect} />);
    const input = screen.getByLabelText("Pesquisar aluno pelo nome");

    await userEvent.type(input, "zzz");
    expect(screen.getByText(/Nenhum aluno com falta registrada/)).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "lucia");
    const results = within(screen.getByRole("list", { name: "Alunos encontrados" }));
    await userEvent.click(results.getByRole("button", { name: /Ana Lúcia/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: "Ana Lúcia", className: "5 ano A" }));
    expect(input).toHaveValue("");
  });

  it("mostra o resumo com a frequência por mês e destaca o pior mês", async () => {
    const report = studentReport(classes, "5 ano A", "Ana Lúcia");
    if (!report) throw new Error("relatório esperado");
    const onClose = vi.fn();
    const onPrint = vi.fn();
    render(<StudentReportCard report={report} onClose={onClose} onPrint={onPrint} />);

    await userEvent.click(screen.getByRole("button", { name: "Baixar PDF" }));
    expect(onPrint).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("heading", { name: "Ana Lúcia" })).toBeInTheDocument();
    expect(screen.getByText("Frequência abaixo de 75%: risco de reprovação por faltas.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Maio de 2026: 50% de frequência" })).toBeInTheDocument();
    const june = screen.getByRole("img", { name: "Junho de 2026: 25% de frequência" }).closest("li");
    expect(within(june as HTMLElement).getByText("Pior mês")).toBeInTheDocument();
    expect(within(june as HTMLElement).getByText("Faltou em: 01/06, 02/06, 04/06")).toBeInTheDocument();
    expect(screen.getAllByText("Pior mês")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Fechar resumo" }));
    expect(onClose).toHaveBeenCalled();
  });
});
