import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));

const api = vi.hoisted(() => ({
  data: null as unknown,
  grades: {} as Record<number, unknown[]>,
  savedList: [] as unknown[],
  savedGrades: [] as { plan: unknown; fileName: string; register: boolean }[],
  pdf: [] as unknown[],
}));
vi.mock("../store/gradeApi", () => ({
  fetchGradeData: async () => ({ data: api.data, error: null }),
  fetchTermGrades: async (_school: string, _year: number, term: number) => ({ data: api.grades[term] ?? [], error: null }),
  saveStudentList: async (_school: string, plan: unknown) => {
    api.savedList.push(plan);
    return null;
  },
  fetchStudentGrades: async (_school: string, studentId: string) => ({
    data: Object.values(api.grades)
      .flat()
      .filter((row) => (row as { studentId: string }).studentId === studentId),
    error: null,
  }),
  saveGradeImport: async (_school: string, _year: number, plan: unknown, fileName: string, register: boolean) => {
    api.savedGrades.push({ plan, fileName, register });
    return { data: 7, error: null };
  },
}));
vi.mock("../utils/pdfReader", () => ({ readPdfText: async () => api.pdf }));

import NotasEscolaresApp from "../notasEscolares/NotasEscolaresApp";
import { useAuthStore } from "../store/authStore";
import { useGradeStore } from "../store/gradeStore";
import type { GradeRow, GradeStudent } from "../types/grade";
import { planGradeImport, type GradeImportPlan } from "../utils/gradeImport";
import { gradeFromRow, gradeStudentFromRow } from "../utils/gradeRows";
import {
  classDisplayName,
  formatScore,
  groupGrades,
  parseScore,
  resultOf,
  segmentOfClass,
  splitStudentName,
  type GradeData,
} from "../utils/grades";
import { classNameOf, isAeeCourse, isoDate, segmentOfCourse, type TextItem } from "../utils/pdfText";
import { parseReportCards, termsWithData } from "../utils/reportCardParser";
import { buildReportCard, evaluationLabel, levelOf } from "../utils/reportCard";
import { planStudentImport } from "../utils/studentImport";
import { parseStudentList } from "../utils/studentListParser";
import { SECRETARY } from "./helpers";

// Tudo fictício: nenhum aluno, professor ou escola real.

const at = (page: number, x: number, y: number, str: string): TextItem => ({ page, x, y, str });

/** Lista de matriculados no layout do sistema da rede (posições x/y como no PDF). */
const LIST_PDF: TextItem[] = [
  at(1, 131, 726, "RELAÇÃO DE ALUNOS MATRICULADOS POR TURMA Exercício:2026"),
  at(1, 35, 711, "Curso:"),
  at(1, 199, 711, "Turno:"),
  at(1, 266, 711, "Série:"),
  at(1, 319, 711, "Turma:"),
  at(1, 62, 710, "ENSINO FUNDAM ENTAL 1º/5º ANOS"),
  at(1, 224, 710, "INTEGRAL"),
  at(1, 290, 710, "5º ANO"),
  at(1, 346, 710, "A"),
  at(1, 35, 699, "Professores(a):"),
  at(1, 102, 699, "MARIA EXEMPLO, JOSE TESTE"),
  at(1, 37, 665, "Nº"),
  at(1, 55, 665, "Nome"),
  at(1, 247, 665, "Matricula"),
  at(1, 498, 665, "Observações"),
  // 1: transferida, com a data quebrada na linha de baixo e a matrícula meio ponto abaixo.
  at(1, 39, 654, "1"),
  at(1, 58, 654, "ALUNA PRIMEIRA DE TESTE TRF"),
  at(1, 289, 654, "09/02/26"),
  at(1, 336, 654, "23/06/14"),
  at(1, 248, 653, "11"),
  at(1, 417, 653, "F"),
  at(1, 58, 646, "04/08/2026"),
  // 2: com observação.
  at(1, 39, 635, "2"),
  at(1, 58, 635, "ALUNO SEGUNDO EXEMPLO"),
  at(1, 248, 635, "12"),
  at(1, 289, 635, "09/02/26"),
  at(1, 336, 635, "12/05/15"),
  at(1, 416, 635, "M"),
  at(1, 498, 635, "TEA/AUTISMO"),
  // 3: matriculado depois do início do ano.
  at(1, 39, 625, "3"),
  at(1, 58, 625, "ALUNA TERCEIRA MATR 10/08/2026"),
  at(1, 248, 625, "13"),
  at(1, 289, 625, "10/08/26"),
  at(1, 417, 625, "F"),
  at(1, 38, 600, "Nº Alunos:"),
  at(1, 84, 600, "3"),
  // Página 2: Atendimento Educacional Especializado, que fica de fora.
  at(2, 131, 726, "RELAÇÃO DE ALUNOS MATRICULADOS POR TURMA Exercício:2026"),
  at(2, 35, 711, "Curso:"),
  at(2, 199, 711, "Turno:"),
  at(2, 266, 711, "Série:"),
  at(2, 319, 711, "Turma:"),
  at(2, 62, 710, "ATENDIM ENTO EDUCACIONAL ESPECIALIZADO"),
  at(2, 272, 710, "M ATUTINO"),
  at(2, 341, 710, "A.E.E"),
  at(2, 389, 710, "A"),
  at(2, 37, 665, "Nº"),
  at(2, 55, 665, "Nome"),
  at(2, 39, 654, "1"),
  at(2, 58, 654, "ALUNO DO AEE"),
];

/** Cabeçalho de um boletim, a partir do y da linha "Aluno". */
function cardHeader(page: number, y: number, name: string, registration: string, roll: string, course: string, series: string, group: string): TextItem[] {
  return [
    at(page, 527, y + 2, `Nº Diário:${roll}`),
    at(page, 27, y, `Aluna:${name} IDCenso:123 Matrícula:${registration}`),
    at(page, 29, y - 11, `Curso: ${course} Turno: INTEGRAL Série: ${series} Turma: ${group}`),
    at(page, 507, y - 11, "Ano Letivo:2026"),
    at(page, 50, y - 28, "DISCIPLINAS"),
  ];
}

/** Uma disciplina: nome na margem, um pouco abaixo da linha dos números. */
function subjectRows(page: number, y: number, name: string, values: [string, string, string, string, string, string, string, string]): TextItem[] {
  const [md1, ft1, md2, ft2, md3, ft3, md4, ft4] = values;
  return [
    at(page, 143, y, md1),
    at(page, 169, y, ft1),
    at(page, 188, y, md2),
    at(page, 215, y, ft2),
    at(page, 232, y, md3),
    at(page, 261, y, ft3),
    at(page, 283, y, md4),
    at(page, 307, y, ft4),
    at(page, 327, y, "29,3"),
    at(page, 19, y - 1, name),
    at(page, 561, y + 2, "APR"),
  ];
}

const EF1 = "ENSINO FUNDAMENTAL 1º/5º ANOS";
const CARDS_PDF: TextItem[] = [
  ...cardHeader(1, 700, "ALUNO SEGUNDO EXEMPLO", "12", "2", EF1, "5º ANO", "A"),
  ...subjectRows(1, 647, "LÍNGUA PORTUGUESA", ["9,4", "2", "5,5", "0", "10,0", "1", "8,0", "2"]),
  ...subjectRows(1, 636, "ESPORTE E LAZER", ["--", "1", "--", "0", "--", "3", "--", "0"]),
  at(1, 108, 600, "Soma:"),
  // Segundo boletim, de um aluno que não está no cadastro.
  ...cardHeader(1, 300, "ALUNO NOVO DE FORA", "99", "4", EF1, "5º ANO", "A"),
  ...subjectRows(1, 247, "LÍNGUA PORTUGUESA", ["7,0", "0", "7,5", "1", "--", "0", "--", "0"]),
  // Boletim do outro segmento no mesmo arquivo.
  ...cardHeader(2, 700, "ALUNA DO SEXTO", "50", "1", "ENSINO FUNDAMENTAL 6º/9º ANOS", "6º ANO", "A"),
  ...subjectRows(2, 647, "LÍNGUA INGLESA", ["8,0", "0", "8,0", "0", "8,0", "0", "--", "0"]),
];

function student(overrides: Partial<GradeStudent>): GradeStudent {
  return {
    id: "s1",
    name: "ALUNA PRIMEIRA DE TESTE",
    className: "5 ano A",
    registration: "",
    rollNumber: 1,
    transferred: false,
    transferredOn: null,
    notes: "",
    ...overrides,
  };
}

function grade(overrides: Partial<GradeRow>): GradeRow {
  return { studentId: "s1", classroomId: "c5a", subjectId: "port", term: 1, md: 6.1, ft: 3, ...overrides };
}

const DATA: GradeData = {
  classrooms: [
    { id: "c6a", schoolYear: 2026, name: "6 ano A", segment: "ef2", shift: "INTEGRAL", teachers: "" },
    { id: "c5a", schoolYear: 2026, name: "5 ano A", segment: "ef1", shift: "INTEGRAL", teachers: "MARIA EXEMPLO, JOSE TESTE" },
  ],
  subjects: [
    { id: "mat", name: "MATEMÁTICA", position: 2 },
    { id: "port", name: "LÍNGUA PORTUGUESA", position: 0 },
  ],
  students: [
    student({ transferred: true, transferredOn: "2026-08-04" }),
    student({ id: "s2", name: "ALUNO SEGUNDO EXEMPLO", rollNumber: 2, registration: "12", notes: "TEA/AUTISMO" }),
    student({ id: "s3", name: "OUTRO ALUNO", className: "6 ano A", rollNumber: 1 }),
  ],
  imports: [],
};

const TERM1: GradeRow[] = [
  grade({}),
  grade({ studentId: "s2", md: 5.5, ft: 0 }),
  grade({ studentId: "s2", subjectId: "mat", md: 9 }),
  grade({ studentId: "s3", classroomId: "c6a", md: null, ft: 2 }),
];

describe("leitura dos PDFs da rede", () => {
  it("entende os pedaços do PDF: segmento, turma, A.E.E. e datas", () => {
    expect(segmentOfCourse("ENSINO FUNDAM ENTAL 1º/5º ANOS")).toBe("ef1");
    expect(segmentOfCourse("ENSINO FUNDAMENTAL 6º/9º ANOS")).toBe("ef2");
    expect(segmentOfCourse("ATENDIMENTO EDUCACIONAL ESPECIALIZADO")).toBeNull();
    expect(isAeeCourse("ATENDIM ENTO EDUCACIONAL ESPECIALIZADO")).toBe(true);
    expect(classNameOf("5º ANO", "A")).toBe("5 ano A");
    expect(isoDate("09/02/26")).toBe("2026-02-09");
    expect(isoDate("31/02/2026")).toBe("");
  });

  it("separa TRF, MATR e observação do nome", () => {
    expect(splitStudentName("ALUNA DE EXEMPLO TRF 04/08/2026")).toMatchObject({
      name: "ALUNA DE EXEMPLO",
      transferred: true,
      transferredOn: "2026-08-04",
    });
    expect(splitStudentName("ALUNA DE EXEMPLO - TRF 04/08/2026").name).toBe("ALUNA DE EXEMPLO");
    expect(splitStudentName("ALUNO TESTE TRF")).toMatchObject({ transferred: true, transferredOn: null });
    expect(splitStudentName("ALUNO TESTE MATR 10/08/2026")).toMatchObject({ name: "ALUNO TESTE", enrolledOn: "2026-08-10" });
    expect(splitStudentName("ALUNO  TESTE - TEA/AUTISMO")).toMatchObject({ name: "ALUNO TESTE", notes: "TEA/AUTISMO" });
    expect(splitStudentName("OUTRO ALUNO")).toEqual({
      name: "OUTRO ALUNO",
      transferred: false,
      transferredOn: null,
      enrolledOn: null,
      notes: "",
    });
  });

  it("lê a lista de matriculados e deixa o A.E.E. de fora", () => {
    const list = parseStudentList(LIST_PDF);
    expect(list.schoolYear).toBe(2026);
    expect(list.skipped).toHaveLength(1);
    expect(list.classes).toHaveLength(1);
    const [fifth] = list.classes;
    expect(fifth).toMatchObject({ className: "5 ano A", segment: "ef1", shift: "INTEGRAL", teachers: "MARIA EXEMPLO, JOSE TESTE" });
    expect(fifth?.students).toEqual([
      {
        rollNumber: 1,
        name: "ALUNA PRIMEIRA DE TESTE",
        registration: "11",
        enrolledOn: "2026-02-09",
        birthDate: "2014-06-23",
        sex: "F",
        transferred: true,
        transferredOn: "2026-08-04",
        notes: "",
      },
      expect.objectContaining({ name: "ALUNO SEGUNDO EXEMPLO", registration: "12", sex: "M", notes: "TEA/AUTISMO" }),
      expect.objectContaining({ name: "ALUNA TERCEIRA", enrolledOn: "2026-08-10", transferred: false }),
    ]);
  });

  it("lê os boletins: média e faltas de cada bimestre, com o nome da disciplina", () => {
    const { cards } = parseReportCards(CARDS_PDF);
    expect(cards.map((c) => [c.name, c.registration, c.rollNumber, c.className, c.segment])).toEqual([
      ["ALUNO SEGUNDO EXEMPLO", "12", 2, "5 ano A", "ef1"],
      ["ALUNO NOVO DE FORA", "99", 4, "5 ano A", "ef1"],
      ["ALUNA DO SEXTO", "50", 1, "6 ano A", "ef2"],
    ]);
    expect(cards[0]?.subjects).toEqual([
      {
        name: "LÍNGUA PORTUGUESA",
        terms: [
          { term: 1, md: 9.4, ft: 2 },
          { term: 2, md: 5.5, ft: 0 },
          { term: 3, md: 10, ft: 1 },
          { term: 4, md: 8, ft: 2 },
        ],
      },
      {
        name: "ESPORTE E LAZER",
        terms: [
          { term: 1, md: null, ft: 1 },
          { term: 2, md: null, ft: 0 },
          { term: 3, md: null, ft: 3 },
          { term: 4, md: null, ft: 0 },
        ],
      },
    ]);
    expect(termsWithData(cards)).toEqual([1, 2, 3, 4]);
  });
});

describe("prévias de envio", () => {
  it("lista de matriculados: atualiza quem já está no cadastro e cria os novos", () => {
    const list = parseStudentList(LIST_PDF);
    const plan = planStudentImport(list, [student({ id: "a1" }), student({ id: "z9", name: "ALUNO QUE SAIU" })], 2026);
    expect(plan.rows.map((row) => [row.id ?? "novo", row.student.name])).toEqual([
      ["a1", "ALUNA PRIMEIRA DE TESTE"],
      ["novo", "ALUNO SEGUNDO EXEMPLO"],
      ["novo", "ALUNA TERCEIRA"],
    ]);
    expect(plan).toMatchObject({ created: 2, updated: 1, transferred: 1 });
    expect(plan.notInList).toEqual([{ className: "5 ano A", name: "ALUNO QUE SAIU" }]);
    expect(plan.classrooms[0]?.teachers).toBe("MARIA EXEMPLO, JOSE TESTE");
  });

  it("boletins: grava só até o bimestre escolhido e lista quem não está no cadastro", () => {
    const { cards } = parseReportCards(CARDS_PDF);
    // A matrícula acha o aluno mesmo com o nome grafado de outro jeito.
    const students = [student({ id: "s2", name: "ALUNO SEGUNDO EXEMPLLO", registration: "12" })];
    const plan = planGradeImport(cards, "ef1", 3, students);
    expect(plan).toMatchObject({ cards: 2, matched: 1, otherSegment: 1, ignoredTerms: [4] });
    expect(plan.subjects).toEqual(["LÍNGUA PORTUGUESA", "ESPORTE E LAZER"]);
    expect(plan.rows.every((row) => row.term <= 3 && row.studentId === "s2")).toBe(true);
    expect(plan.rows).toHaveLength(6);
    expect(plan.unmatched.map((card) => [card.name, card.registration, card.scores.length])).toEqual([
      ["ALUNO NOVO DE FORA", "99", 3],
    ]);
  });
});

describe("regras das notas", () => {
  it("escreve as notas com uma casa e vírgula, e dá o histórico pela média", () => {
    expect(formatScore(9.5)).toBe("9,5");
    expect(formatScore(10)).toBe("10,0");
    expect(formatScore(null)).toBe("");
    expect(parseScore("9,5")).toBe(9.5);
    expect(parseScore("11")).toBeNull();
    expect(resultOf(6)).toBe("approved");
    expect(resultOf(5.9)).toBe("failed");
    expect(resultOf(null)).toBeNull();
    expect(classDisplayName("5 ano A")).toBe("5º ANO - A");
    expect(segmentOfClass("9 ano A")).toBe("ef2");
  });

  it("converte as linhas do banco e descarta as incompletas", () => {
    expect(gradeFromRow({ student_id: "s1", classroom_id: "c", subject_id: "p", term: 1, md: "9.5", ft: 2 })).toMatchObject({
      md: 9.5,
      ft: 2,
    });
    expect(gradeFromRow({ student_id: "s1", classroom_id: "c", subject_id: "p", term: 5 })).toBeNull();
    expect(gradeStudentFromRow({ id: "s", name: "X", status: "active", transferred_on: "2026-01-02" })).toMatchObject({
      transferred: false,
      transferredOn: null,
    });
  });

  it("agrupa por segmento, turma e disciplina, e filtra", () => {
    const all = groupGrades(DATA, TERM1, { term: 1, classroomId: "", subjectId: "", query: "" });
    expect(all.map((s) => s.title)).toEqual([
      "Ensino Fundamental 1º/5º anos – Integral",
      "Ensino Fundamental 6º/9º anos – Integral",
    ]);
    const fifth = all[0]?.classes[0];
    expect(fifth?.subjects.map((s) => s.subject.name)).toEqual(["LÍNGUA PORTUGUESA", "MATEMÁTICA"]);
    expect(fifth?.subjects[0]?.lines.map((l) => [l.student.name, l.result])).toEqual([
      ["ALUNA PRIMEIRA DE TESTE", "approved"],
      ["ALUNO SEGUNDO EXEMPLO", "failed"],
    ]);
    const filtered = groupGrades(DATA, TERM1, { term: 1, classroomId: "c5a", subjectId: "mat", query: "" });
    expect(filtered[0]?.classes[0]?.subjects.map((s) => s.subject.id)).toEqual(["mat"]);
    const searched = groupGrades(DATA, TERM1, { term: 1, classroomId: "", subjectId: "", query: "outro" });
    expect(searched.map((s) => s.segment)).toEqual(["ef2"]);
  });
});

describe("tela de notas", () => {
  beforeEach(() => {
    api.data = DATA;
    api.grades = { 1: TERM1 };
    api.savedList = [];
    api.savedGrades = [];
    useGradeStore.setState({ status: "idle", schoolYear: null, terms: {}, termStatus: {} });
    useAuthStore.setState({ status: "signedIn", profile: SECRETARY, error: null });
  });

  it("abre no 1º bimestre com as turmas fechadas, agrupadas por segmento", async () => {
    render(<NotasEscolaresApp />);
    expect(await screen.findByRole("heading", { name: "Ensino Fundamental 1º/5º anos – Integral" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Bimestre" })).toHaveValue("1");
    expect(screen.getByRole("button", { name: /5º ANO - A/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("mostra média, faltas, histórico, transferido, observação e os professores da turma", async () => {
    const user = userEvent.setup();
    render(<NotasEscolaresApp />);
    await user.click(await screen.findByRole("button", { name: /5º ANO - A/ }));
    const section = screen.getByRole("region", { name: "5º ANO - A · LÍNGUA PORTUGUESA" });
    expect(within(section).getByText("MARIA EXEMPLO, JOSE TESTE")).toBeInTheDocument();
    const rows = within(section).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("ALUNA PRIMEIRA DE TESTE");
    expect(rows[1]).toHaveTextContent("TRF 04/08/2026");
    expect(rows[1]).toHaveTextContent("6,1");
    expect(within(rows[1] as HTMLElement).getByText("APROVADO(A)")).toHaveClass("text-accent-light");
    expect(rows[2]).toHaveTextContent("TEA/AUTISMO");
    expect(within(rows[2] as HTMLElement).getByText("REPROVADO(A)")).toHaveClass("text-prio-urgent");
  });

  it("filtra por turma e disciplina e busca pelo nome", async () => {
    const user = userEvent.setup();
    render(<NotasEscolaresApp />);
    await user.selectOptions(await screen.findByRole("combobox", { name: "Filtrar por disciplina" }), "MATEMÁTICA");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por turma" }), "5º ANO - A");
    expect(screen.getAllByRole("table")).toHaveLength(1);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por turma" }), "Todas as turmas");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por disciplina" }), "Todas as disciplinas");
    await user.type(screen.getByRole("searchbox", { name: "Buscar aluno" }), "outro");
    expect(screen.getByRole("table", { name: "6º ANO - A · LÍNGUA PORTUGUESA" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /5º ANO - A/ })).not.toBeInTheDocument();
  });

  it("avisa quando o bimestre não tem notas e mostra os históricos como em breve", async () => {
    const user = userEvent.setup();
    render(<NotasEscolaresApp />);
    await user.selectOptions(await screen.findByRole("combobox", { name: "Bimestre" }), "4º bimestre");
    expect(await screen.findByText("Nenhuma nota do 4º bimestre ainda")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Históricos escolares/ }));
    expect(screen.getByText("Históricos escolares: em breve")).toBeInTheDocument();
  });

  it("envia o boletim do EF I até o 3º bimestre, com a prévia e os não encontrados", async () => {
    const user = userEvent.setup();
    api.pdf = CARDS_PDF;
    render(<NotasEscolaresApp />);
    await user.click(await screen.findByRole("button", { name: "Enviar notas EF I" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Salvar notas" })).toBeDisabled();
    await user.selectOptions(dialog.getByRole("combobox", { name: "Bimestre" }), "Até o 3º bimestre");
    await user.upload(dialog.getByLabelText("Arquivo PDF do boletim"), new File(["%PDF"], "EFI.pdf", { type: "application/pdf" }));

    expect(await dialog.findByText(/O arquivo também traz o 4º bimestre/)).toBeInTheDocument();
    expect(dialog.getByText("1 aluno não encontrado no cadastro")).toBeInTheDocument();
    expect(dialog.getByText(/ALUNO NOVO DE FORA/)).toBeInTheDocument();
    await user.click(dialog.getByRole("checkbox", { name: /Cadastrar este aluno/ }));
    await user.click(dialog.getByRole("button", { name: "Salvar notas" }));

    await waitFor(() => expect(api.savedGrades).toHaveLength(1));
    const saved = api.savedGrades[0];
    expect(saved?.fileName).toBe("EFI.pdf");
    expect(saved?.register).toBe(true);
    const plan = saved?.plan as GradeImportPlan;
    expect(plan.upToTerm).toBe(3);
    expect(plan.rows.some((row) => row.term === 4)).toBe(false);
    expect(await screen.findByText(/Notas do EF I salvas/)).toBeInTheDocument();
  });

  it("não aceita o arquivo do outro segmento", async () => {
    const user = userEvent.setup();
    api.pdf = CARDS_PDF.filter((item) => item.page === 2);
    render(<NotasEscolaresApp />);
    await user.click(await screen.findByRole("button", { name: "Enviar notas EF I" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.selectOptions(dialog.getByRole("combobox", { name: "Bimestre" }), "Até o 3º bimestre");
    await user.upload(dialog.getByLabelText("Arquivo PDF do boletim"), new File(["%PDF"], "EFII.pdf", { type: "application/pdf" }));
    expect(await dialog.findByText(/não tem boletins do EF I/)).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Salvar notas" })).toBeDisabled();
  });

  it("envia a lista de matriculados com a prévia por turma", async () => {
    const user = userEvent.setup();
    api.pdf = LIST_PDF;
    render(<NotasEscolaresApp />);
    await user.click(await screen.findByRole("button", { name: "Cadastro de alunos" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.upload(dialog.getByLabelText("Arquivo PDF da lista"), new File(["%PDF"], "lista.pdf", { type: "application/pdf" }));
    expect(await dialog.findByText(/TRF: ALUNA PRIMEIRA DE TESTE \(04\/08\/2026\)/)).toBeInTheDocument();
    expect(dialog.getByText(/ALUNO SEGUNDO EXEMPLO \(TEA\/AUTISMO\)/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Salvar cadastro" }));
    await waitFor(() => expect(api.savedList).toHaveLength(1));
    expect(await screen.findByText(/Cadastro atualizado/)).toBeInTheDocument();
  });

  it("clica no aluno e vê o boletim, que baixa em PDF pela impressão", async () => {
    const user = userEvent.setup();
    api.grades = {
      1: TERM1,
      2: [grade({ term: 2, md: 8 }), grade({ term: 2, subjectId: "mat", md: 9.5, ft: 1 })],
    };
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<NotasEscolaresApp />);
    await user.click(await screen.findByRole("button", { name: /5º ANO - A/ }));
    const section = screen.getByRole("region", { name: "5º ANO - A · LÍNGUA PORTUGUESA" });
    await user.click(within(section).getByRole("button", { name: "Ver o boletim de ALUNA PRIMEIRA DE TESTE" }));

    const dialog = within(await screen.findByRole("dialog", { name: "Boletim · ALUNA PRIMEIRA DE TESTE" }));
    const sheet = within(await dialog.findByRole("article", { name: "Boletim de ALUNA PRIMEIRA DE TESTE" }));
    expect(sheet.getByText("1º e 2º bimestres")).toBeInTheDocument();
    expect(sheet.getByText("Média parcial")).toBeInTheDocument();
    const portuguese = sheet.getByRole("row", { name: /LÍNGUA PORTUGUESA/ });
    // 6,1 no 1º e 8,0 no 2º; 3º e 4º contam 0: (6,1 + 8 + 0 + 0) / 4 = 3,5.
    expect(portuguese).toHaveTextContent("6,1");
    expect(portuguese).toHaveTextContent("3,5");
    expect(within(portuguese).getByRole("img", { name: "Em Desenvolvimento" })).toBeInTheDocument();
    // Faltas da matéria logo depois das notas: 3 no 1º bimestre, 3 no 2º, total 6.
    expect(within(portuguese).getAllByRole("cell").map((cell) => cell.textContent).slice(4, 9)).toEqual(["3", "3", "", "", "6"]);
    // Pizza: 3 faltas no 1º e 3 + 1 (Matemática) no 2º.
    expect(sheet.getByRole("img", { name: "Faltas por bimestre: 7 no total" })).toBeInTheDocument();

    await user.click(dialog.getByRole("button", { name: /Baixar boletim/ }));
    await waitFor(() => expect(print).toHaveBeenCalled());
    expect(document.querySelector(".print-document.boletim")).not.toBeNull();
    expect(document.title).toBe("Boletim - ALUNA PRIMEIRA DE TESTE");
    window.dispatchEvent(new Event("afterprint"));
    await waitFor(() => expect(document.querySelector(".print-document.boletim")).toBeNull());
    print.mockRestore();
  });
});

describe("boletim do aluno", () => {
  it("dá a situação pela faixa da média", () => {
    expect(levelOf(5.9)).toBe("developing");
    expect(levelOf(6)).toBe("satisfactory");
    expect(levelOf(7.9)).toBe("satisfactory");
    expect(levelOf(8)).toBe("good");
    expect(levelOf(8.9)).toBe("good");
    expect(levelOf(9)).toBe("excellent");
    expect(levelOf(null)).toBeNull();
  });

  it("monta médias, situação e faltas; atividades sem nota só somam faltas", () => {
    const subjects = [
      { id: "port", name: "LÍNGUA PORTUGUESA", position: 0 },
      { id: "lazer", name: "ESPORTE E LAZER", position: 1 },
    ];
    const report = buildReportCard(
      [
        grade({ term: 1, md: 9.4, ft: 2 }),
        grade({ term: 2, md: 9.9, ft: 0 }),
        grade({ term: 3, md: 10, ft: 1 }),
        grade({ subjectId: "lazer", term: 1, md: null, ft: 3 }),
      ],
      subjects,
    );
    // Média sobre os quatro bimestres, o 4º sem nota conta 0: (9,4 + 9,9 + 10 + 0) / 4 = 7,3.
    expect(report.subjects).toEqual([
      {
        name: "LÍNGUA PORTUGUESA",
        terms: [9.4, 9.9, 10, null],
        average: 7.3,
        level: "satisfactory",
        absences: [2, 0, 1, null],
        absenceTotal: 3,
      },
    ]);
    expect(report.activities).toEqual({ names: ["ESPORTE E LAZER"], absences: [3, null, null, null], absenceTotal: 3 });
    expect(report.termsWithGrades).toEqual([1, 2, 3]);
    expect(report.complete).toBe(false);
    expect(report.absencesByTerm).toEqual([5, 0, 1, null]);
    expect(report.absences).toBe(6);
    expect(report.absenceShares.map((share) => Math.round(share * 100))).toEqual([83, 0, 17, 0]);
  });

  it("média: 10 nos três primeiros bimestres dá 7,5 até o 4º ter nota", () => {
    const subjects = [{ id: "port", name: "LÍNGUA PORTUGUESA", position: 0 }];
    const partial = buildReportCard([1, 2, 3].map((term) => grade({ term: term as 1 | 2 | 3, md: 10 })), subjects);
    expect(partial.subjects[0]?.average).toBe(7.5);
    const full = buildReportCard([1, 2, 3, 4].map((term) => grade({ term: term as 1 | 2 | 3 | 4, md: 10 })), subjects);
    expect(full.subjects[0]?.average).toBe(10);
    expect(full.complete).toBe(true);
  });

  it("descreve os bimestres avaliados", () => {
    expect(evaluationLabel([1])).toBe("1º bimestre");
    expect(evaluationLabel([1, 2])).toBe("1º e 2º bimestres");
    expect(evaluationLabel([1, 2, 3])).toBe("1º ao 3º bimestre");
    expect(evaluationLabel([])).toBe("");
  });
});
