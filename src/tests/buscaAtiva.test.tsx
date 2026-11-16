import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BuscaAtivaDocument } from "../components/attendance/BuscaAtivaDocument";
import { StudentReportCard } from "../components/attendance/StudentReportCard";
import { letterheadOf } from "../constants/buscaAtiva";
import type { StudentReport } from "../types/attendance";
import type { StudentRecord } from "../types/student";
import { canSeeStudentRecords } from "../utils/roles";
import { EMPTY_IDENTITY } from "../utils/schoolIdentity";
import { absenceMonthsText, absencesText, alertNotes, findStudent, fullAddress, studentFromRow } from "../utils/students";

// Escola e alunos fictícios: nenhum dado real entra nos testes.
const IDENTITY = {
  ...EMPTY_IDENTITY,
  officialName: "EMEF Escola de Exemplo",
  inep: "12345678",
  address: "Rua das Flores, sem número, Bairro: Centro",
  principalName: "Maria de Exemplo",
};

const STUDENT: StudentRecord = {
  schoolYear: 2026,
  className: "6 ano A",
  name: "ALUNO DE EXEMPLO",
  sex: "M",
  birthDate: "2014-03-09",
  guardianName: "RESPONSAVEL DE EXEMPLO",
  guardianNis: "12345678901",
  phone: "",
  address: "RUA DAS FLORES, 10",
  neighborhood: "CENTRO",
  cep: "69400-000",
};

const REPORT: StudentReport = {
  name: "Aluno de Exemplo",
  className: "6 ano A",
  absences: 5,
  schoolDays: 40,
  rate: 0.125,
  streak: 0,
  risk: "ok",
  presenceRate: 0.875,
  lastAbsence: "2026-08-19",
  months: [
    { month: "2026-06", label: "Junho de 2026", schoolDays: 10, absences: 0, presenceRate: 1, risk: "ok", dates: [] },
    { month: "2026-07", label: "Julho de 2026", schoolDays: 10, absences: 2, presenceRate: 0.8, risk: "warning", dates: ["2026-07-02", "2026-07-03"] },
    { month: "2026-08", label: "Agosto de 2026", schoolDays: 20, absences: 3, presenceRate: 0.85, risk: "ok", dates: ["2026-08-05", "2026-08-12", "2026-08-19"] },
  ],
};

describe("cadastro dos alunos", () => {
  it("lê a linha do banco com segurança", () => {
    expect(
      studentFromRow({
        school_year: 2026,
        class_name: "6 ano A",
        name: " ALUNO DE EXEMPLO ",
        sex: "M",
        birth_date: "2014-03-09",
        guardian_name: "RESPONSAVEL DE EXEMPLO",
        guardian_nis: "12345678901",
        phone: null,
        address: "RUA DAS FLORES, 10",
        neighborhood: "CENTRO",
        cep: "69400-000",
      }),
    ).toEqual(STUDENT);
    expect(studentFromRow({ class_name: "6 ano A", name: "Sem Dados", sex: "X", birth_date: "09/03/2014" })).toMatchObject({
      sex: "",
      birthDate: "",
      guardianName: "",
      address: "",
    });
    expect(studentFromRow({ name: "Sem turma" })).toBeNull();
    expect(studentFromRow(null)).toBeNull();
  });

  it("acha o aluno da frequência sem depender de acento, caixa ou espaços", () => {
    const other = { ...STUDENT, name: "JOSÉ DE EXEMPLO", className: "7 ano B" };
    const records = [STUDENT, other];
    expect(findStudent(records, "6 ano A", "  aluno  de exemplo ")).toBe(STUDENT);
    // Turma diferente na planilha: vale o nome, se for único na escola.
    expect(findStudent(records, "7 ano A", "Jose de Exemplo")).toBe(other);
    expect(findStudent(records, "6 ano A", "Ninguém")).toBeNull();
    // Homônimos em turmas diferentes: sem a turma certa, não arrisca.
    const twins = [STUDENT, { ...STUDENT, className: "6 ano B" }];
    expect(findStudent(twins, "6 ano C", "Aluno de Exemplo")).toBeNull();
    expect(findStudent(twins, "6 ano B", "Aluno de Exemplo")?.className).toBe("6 ano B");
  });

  it("monta os textos do termo e do formulário", () => {
    expect(absenceMonthsText(REPORT.months)).toBe("nos meses de julho e agosto");
    expect(absenceMonthsText(REPORT.months.slice(0, 2))).toBe("no mês de julho");
    expect(absenceMonthsText([...REPORT.months, { month: "2026-09", absences: 1 }])).toBe(
      "nos meses de julho, agosto e setembro",
    );
    expect(absenceMonthsText([])).toBe("");
    expect(absencesText(5)).toBe("05 faltas escolares");
    expect(absencesText(1)).toBe("01 falta escolar");
    expect(absencesText(12)).toBe("12 faltas escolares");
    expect(fullAddress(STUDENT)).toBe("RUA DAS FLORES, 10 – CENTRO");
    expect(fullAddress({ address: "", neighborhood: "" })).toBe("");
    expect(alertNotes(REPORT)).toContain("Turma 6 ano A · 5 faltas em 40 dias de chamada");
    expect(alertNotes(REPORT)).toContain("última falta em 19/08/2026");
  });

  it("só a equipe da secretaria vê o cadastro", () => {
    expect(canSeeStudentRecords("secretary")).toBe(true);
    expect(canSeeStudentRecords("assistant")).toBe(true);
    expect(canSeeStudentRecords("teacher")).toBe(false);
    expect(canSeeStudentRecords("master")).toBe(false);
  });
});

describe("documento de busca ativa", () => {
  const renderDocument = (student: StudentRecord | null, identity = IDENTITY) =>
    render(
      <BuscaAtivaDocument
        report={REPORT}
        student={student}
        identity={identity}
        issuedOn="2026-08-20"
        countedUntil="2026-08-19"
      />,
    );
  const fieldText = (area: string) => document.querySelector(`.busca-field-${area}`)?.textContent ?? null;

  it("preenche o formulário de alerta e o termo com o cadastro do aluno", () => {
    renderDocument(STUDENT);
    expect(document.querySelectorAll(".busca-page")).toHaveLength(3);
    expect(fieldText("name")).toBe("ALUNO DE EXEMPLO");
    expect(fieldText("guardian")).toBe("RESPONSAVEL DE EXEMPLO");
    expect(fieldText("birth")).toBe("09/03/2014");
    expect(fieldText("address")).toBe("RUA DAS FLORES, 10");
    expect(fieldText("cep")).toBe("69.400-000");
    expect(fieldText("neighborhood")).toBe("CENTRO");
    expect(document.querySelector(".busca-check-m")).not.toBeNull();
    expect(document.querySelector(".busca-check-f")).toBeNull();

    const term = document.querySelector(".busca-term")?.textContent ?? "";
    expect(term).toContain("RUA DAS FLORES, 10 – CENTRO");
    expect(term).toContain("6 ANO A");
    expect(term).toContain("20/08/2026");
    expect(term).toContain("até a data 19/08/2026");
    expect(term).toContain("05 faltas escolares nos meses de julho e agosto");
    expect(term).toContain("comunicado pela EMEF Escola de Exemplo, localizada na Rua das Flores");
    expect(term).toContain("na pessoa de Maria de Exemplo");
    // A convocação é para o dia em que o documento é emitido, sem horário.
    expect(term).toContain("no dia 20/08/2026, para que possamos");
    expect(term).not.toContain("____");
    expect(term).toContain("Artigos 53, 55 e 56 da Lei Federal 8.069 de 13 de julho de 1990");
  });

  it("deixa em branco o que não há no cadastro", () => {
    renderDocument(null, EMPTY_IDENTITY);
    expect(fieldText("name")).toBe("ALUNO DE EXEMPLO");
    for (const area of ["guardian", "birth", "address", "cep", "neighborhood"]) expect(fieldText(area)).toBeNull();
    expect(document.querySelector(".busca-check")).toBeNull();
    expect(document.querySelector(".busca-term")?.textContent).not.toContain("na pessoa de");
  });

  it("usa o papel timbrado só da escola que tem um; as demais recebem o cabeçalho simples", () => {
    expect(letterheadOf("12345678")).toBeUndefined();
    renderDocument(STUDENT);
    expect(document.querySelector(".busca-plain-header")?.textContent).toContain("EMEF Escola de Exemplo");
  });

  it("o resumo do aluno oferece “Busca ativa” só para quem pode", async () => {
    const onBuscaAtiva = vi.fn();
    const { rerender } = render(<StudentReportCard report={REPORT} onClose={() => {}} onPrint={() => {}} />);
    expect(screen.getByRole("button", { name: "Baixar resumo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Busca ativa" })).not.toBeInTheDocument();

    rerender(<StudentReportCard report={REPORT} onClose={() => {}} onPrint={() => {}} onBuscaAtiva={onBuscaAtiva} />);
    await userEvent.click(screen.getByRole("button", { name: "Busca ativa" }));
    expect(onBuscaAtiva).toHaveBeenCalledTimes(1);
  });
});
