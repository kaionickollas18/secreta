import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));

// Cadastro das Notas com uma turma e três alunos fictícios.
vi.mock("../store/gradeApi", () => ({
  fetchGradeData: async () => ({
    data: {
      classrooms: [{ id: "c9a", schoolYear: 2027, name: "9 ano A", segment: "ef2", shift: "INTEGRAL", teachers: "" }],
      subjects: [],
      imports: [],
      reinforcement: [],
      students: [
        { id: "s1", name: "ALUNO UM", className: "9 ano A", registration: "", rollNumber: 1, transferred: false, transferredOn: null, notes: "" },
        { id: "s2", name: "ALUNA DOIS", className: "9 ano A", registration: "", rollNumber: 2, transferred: false, transferredOn: null, notes: "" },
        { id: "s3", name: "ALUNO SAIU", className: "9 ano A", registration: "", rollNumber: 3, transferred: true, transferredOn: null, notes: "" },
      ],
    },
    error: null,
  }),
  fetchClassGrades: async () => ({ data: [], error: null }),
  fetchStudentGrades: async () => ({ data: [], error: null }),
  saveReinforcement: async () => ({ data: null, error: "x" }),
  removeReinforcement: async () => null,
}));
// Avaliações em memória (no lugar do Supabase), contando as gravações.
const db = vi.hoisted(() => ({
  assessments: new Map<string, unknown>(),
  sheets: new Map<string, { assessmentId: string; slot: number }>(),
  assessmentSaves: 0,
}));
vi.mock("../store/assessmentApi", () => ({
  fetchAssessments: async () => ({
    data: { assessments: [...db.assessments.values()], sheets: [...db.sheets.values()] },
    error: null,
  }),
  saveAssessment: async (_school: string, assessment: { id: string }) => {
    db.assessmentSaves += 1;
    db.assessments.set(assessment.id, assessment);
    return { data: assessment, error: null };
  },
  deleteAssessment: async (_school: string, id: string) => {
    db.assessments.delete(id);
    return null;
  },
  saveSheet: async (_school: string, sheet: { id: string; assessmentId: string; slot: number }) => {
    for (const [id, other] of db.sheets)
      if (other.assessmentId === sheet.assessmentId && other.slot === sheet.slot) db.sheets.delete(id);
    db.sheets.set(sheet.id, sheet);
    return { data: sheet, error: null };
  },
  deleteSheet: async (_school: string, id: string) => {
    db.sheets.delete(id);
    return null;
  },
}));
vi.mock("../store/schoolApi", () => ({
  fetchIdentity: async () => ({
    data: { officialName: "Escola de Teste", inep: "", address: "", cep: "", decree: "", principalName: "" },
    error: null,
  }),
  saveIdentity: async () => null,
  uploadLogo: async () => ({ data: null, error: "x" }),
  removeLogo: async () => null,
}));

import AvaliacoesApp from "../avaliacoes/AvaliacoesApp";
import { useAssessmentStore } from "../store/assessmentStore";
import { useAuthStore } from "../store/authStore";
import { useGradeStore } from "../store/gradeStore";
import { SECRETARY } from "./helpers";

describe("página Avaliações", () => {
  beforeEach(() => {
    window.location.hash = "";
    db.assessments.clear();
    db.sheets.clear();
    db.assessmentSaves = 0;
    useAssessmentStore.setState({ status: "idle", schoolId: null, assessments: [], sheets: [], draftStatus: "idle", draftError: null });
    useGradeStore.setState({ status: "idle", schoolYear: null, classes: {}, students: {} });
    useAuthStore.setState({ status: "signedIn", profile: SECRETARY, error: null });
  });

  it("cria a avaliação, monta o gabarito com descritores, lança um cartão e mostra os resultados", async () => {
    const user = userEvent.setup();
    render(<AvaliacoesApp />);

    await user.click(await screen.findByRole("button", { name: /nova avaliação/i }));
    expect(db.assessmentSaves).toBe(1);
    await user.type(screen.getByLabelText("Título"), "Simulado Saeb");
    // Digitar o título inteiro grava uma vez só, depois de parar de digitar.
    expect(db.assessmentSaves).toBe(1);
    expect(await screen.findByText(/· Salvo/)).toBeInTheDocument();
    expect(db.assessmentSaves).toBe(2);
    expect(db.assessments.get([...db.assessments.keys()][0] as string)).toMatchObject({ title: "Simulado Saeb" });
    await user.selectOptions(screen.getByLabelText("Turma"), "c9a");
    // Turma do 9º ano: matriz do Saeb e alunos ativos do cadastro (o transferido fica de fora).
    expect(screen.getByLabelText("Matriz de descritores")).toHaveValue("saeb9");
    expect(screen.getByRole("heading", { name: "Alunos (2)" })).toBeInTheDocument();

    const count = screen.getByLabelText("Questões");
    await user.clear(count);
    await user.type(count, "3");
    await user.type(screen.getByPlaceholderText(/colar gabarito/i), "BDA");
    await user.click(screen.getByRole("button", { name: "Preencher" }));
    expect(within(screen.getByRole("radiogroup", { name: "Gabarito da questão 2" })).getByRole("radio", { name: "D" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.selectOptions(screen.getByLabelText("Acrescentar descritor à questão 1"), "D6");
    expect(screen.getByRole("button", { name: "Tirar o descritor D6 da questão 1" })).toBeInTheDocument();

    // Cartões: dois cartões nominais, com os quadrados e o código.
    await user.click(screen.getByRole("link", { name: /cartões/i }));
    expect(screen.getByRole("button", { name: "Imprimir 2 cartões" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cartão-resposta de ALUNO UM" })).toBeInTheDocument();

    // Correção manual: aluno 1 erra a questão 1.
    await user.click(screen.getByRole("link", { name: /correção/i }));
    await user.click(screen.getByRole("button", { name: "Lançar à mão" }));
    const dialog = await screen.findByRole("dialog", { name: "Conferir cartão" });
    expect(within(dialog).getByRole("button", { name: "Salvar" })).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText("Aluno"), "1");
    await user.click(within(within(dialog).getByRole("radiogroup", { name: "Resposta da questão 1" })).getByRole("radio", { name: "C" }));
    await user.click(within(within(dialog).getByRole("radiogroup", { name: "Resposta da questão 2" })).getByRole("radio", { name: "D" }));
    await user.click(within(within(dialog).getByRole("radiogroup", { name: "Resposta da questão 3" })).getByRole("radio", { name: "A" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Corrigidos (1 de 2)" })).toBeInTheDocument();
    // O gabarito editado já estava no banco quando o cartão foi salvo.
    expect(db.sheets.size).toBe(1);
    expect([...db.assessments.values()][0]).toMatchObject({ questions: [{ key: "B" }, { key: "D" }, { key: "A" }] });

    // Resultados: 2 de 3 = 67%, questão 1 é a mais errada, com o descritor D6.
    await user.click(screen.getByRole("link", { name: /resultados/i }));
    expect(screen.getAllByText("67%").length).toBeGreaterThan(0);
    const questions = screen.getByRole("table");
    const firstRow = within(questions).getAllByRole("row")[1] as HTMLElement;
    expect(within(firstRow).getByRole("rowheader")).toHaveTextContent("1");
    expect(firstRow).toHaveTextContent("D6");
    expect(firstRow).toHaveTextContent("C (100% da turma)");
    expect(screen.getByRole("heading", { name: "Alunos em situação crítica (0)" })).toBeInTheDocument();

    // Subindo o limiar, o aluno passa a aparecer como crítico.
    await user.selectOptions(screen.getByLabelText("Limiar"), "70");
    expect(screen.getByRole("heading", { name: "Alunos em situação crítica (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver o cartão de ALUNO UM" })).toBeInTheDocument();
  });
});
