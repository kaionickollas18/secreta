import { describe, expect, it } from "vitest";
import { DESCRIPTOR_CATALOG } from "../constants/descriptors";
import { assessmentFromRow, assessmentToRow, rowsOf, sheetFromRow, sheetToRow } from "../utils/assessmentRows";
import type { AnswerSheet, Assessment, Choice, MarkFlag } from "../types/assessment";
import {
  classHistory,
  classSummary,
  criticalStudents,
  descriptorStats,
  questionStats,
} from "../utils/assessmentAnalytics";
import {
  assessmentProblems,
  gradeFromClassName,
  isAssessment,
  mergeRoster,
  newAssessment,
  nextCode,
  parseNameList,
  scoreSheet,
} from "../utils/assessments";
import { manualPending, needsReview, readyToSave, setAnswer, toAnswerSheet } from "../utils/sheetReview";

// Nomes fictícios: nenhum dado real de aluno entra nos testes.
function makeAssessment(overrides: Partial<Assessment> = {}): Assessment {
  const base = newAssessment({ id: "av-1", now: "2027-03-10T12:00:00.000Z", existing: [], className: "9 ano A", subject: "lp" });
  return {
    ...base,
    title: "Simulado 1",
    questions: [
      { number: 1, key: "A", descriptorCodes: ["D1"] },
      { number: 2, key: "B", descriptorCodes: ["D1", "D6"] },
      { number: 3, key: "C", descriptorCodes: ["D6"] },
      { number: 4, key: "D", descriptorCodes: ["D3"] },
      { number: 5, key: null, descriptorCodes: ["D3"] },
    ],
    roster: [
      { slot: 1, studentId: "s1", name: "Aluno Um", rollNumber: 1 },
      { slot: 2, studentId: "s2", name: "Aluna Dois", rollNumber: 2 },
      { slot: 3, studentId: "s3", name: "Aluno Três", rollNumber: 3 },
      { slot: 4, studentId: "s4", name: "Aluna Quatro", rollNumber: 4 },
    ],
    ...overrides,
  };
}

const sheet = (slot: number, answers: (Choice | null)[], assessmentId = "av-1"): AnswerSheet => ({
  id: `sheet-${assessmentId}-${slot}`,
  assessmentId,
  slot,
  studentId: `s${slot}`,
  studentName: `Aluno ${slot}`,
  answers,
  flags: answers.map(() => "ok"),
  source: "camera",
  edited: false,
  scannedAt: "2027-03-11T10:00:00.000Z",
});

describe("criação e validação", () => {
  it("sugere o ano e a matriz pela turma", () => {
    expect(gradeFromClassName("9 ano A")).toBe(9);
    expect(gradeFromClassName("1º ano B")).toBe(1);
    expect(gradeFromClassName("Turma Azul")).toBeNull();
    const first = newAssessment({ id: "x", now: "2027-02-01T00:00:00Z", existing: [], className: "1 ano A" });
    expect(first).toMatchObject({ grade: 1, matrix: "cnca1", alternatives: 4, code: 1, date: "2027-02-01" });
    expect(newAssessment({ id: "y", now: "2027-02-01T00:00:00Z", existing: [], className: "9 ano B" }).matrix).toBe("saeb9");
    expect(newAssessment({ id: "z", now: "2027-02-01T00:00:00Z", existing: [], className: "8 ano A" }).matrix).toBe("sadeam8");
  });

  it("usa o menor código de cartão livre", () => {
    expect(nextCode([makeAssessment({ code: 1 }), makeAssessment({ code: 3 })])).toBe(2);
  });

  it("aponta o que falta para imprimir", () => {
    expect(assessmentProblems(makeAssessment())).toEqual([]);
    expect(assessmentProblems(makeAssessment({ title: " ", className: "" }))).toEqual([
      "Dê um título à avaliação.",
      "Escolha a turma.",
    ]);
    const noKey = makeAssessment({ questions: [{ number: 1, key: null, descriptorCodes: [] }] });
    expect(assessmentProblems(noKey)).toContain("Preencha o gabarito.");
  });

  it("valida o que vem do armazenamento", () => {
    expect(isAssessment(makeAssessment())).toBe(true);
    expect(isAssessment({ ...makeAssessment(), subject: "ciencias" })).toBe(false);
    expect(isAssessment({ ...makeAssessment(), code: 999 })).toBe(false);
  });

  it("traz alunos sem mudar o número de quem já está", () => {
    const roster = mergeRoster(
      [{ slot: 1, studentId: "s1", name: "Aluno Um", rollNumber: 1 }],
      [
        { id: "s3", name: "Aluno Três", rollNumber: 3 },
        { id: "s1", name: "Aluno Um", rollNumber: 1 },
        { id: "s2", name: "Aluna Dois", rollNumber: 2 },
      ],
    );
    expect(roster.map((r) => [r.slot, r.name])).toEqual([
      [1, "Aluno Um"],
      [2, "Aluna Dois"],
      [3, "Aluno Três"],
    ]);
    // Nome digitado repetido (com ou sem acento) não entra duas vezes.
    const typed = mergeRoster(
      roster,
      parseNameList("1. ALUNO TRES\nAluna Cinco\n\n").map((name) => ({ id: null, name, rollNumber: null })),
    );
    expect(typed.map((r) => r.name).slice(3)).toEqual(["Aluna Cinco"]);
  });

  it("tem os descritores do Saeb 9º ano, do SADEAM 8º ano e do CNCA 1º ano", () => {
    const count = (matrix: string, subject: string) =>
      DESCRIPTOR_CATALOG.filter((d) => d.matrix === matrix && d.subject === subject).length;
    expect(count("saeb9", "lp")).toBe(21);
    expect(count("saeb9", "mt")).toBe(37);
    expect(count("cnca1", "lp")).toBe(15);
    expect(count("cnca1", "mt")).toBe(13);
    expect(count("sadeam8", "lp")).toBe(17);
    expect(count("sadeam8", "mt")).toBe(30);
    const codes = DESCRIPTOR_CATALOG.map((d) => `${d.matrix}:${d.subject}:${d.code}`);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("correção", () => {
  it("conta acertos, ignora anulada e trata branco como erro", () => {
    const score = scoreSheet(makeAssessment(), { answers: ["A", "C", null, "D", "B"] });
    expect(score).toMatchObject({ correct: 2, scored: 4, percent: 0.5 });
    expect(score.outcomes).toEqual(["right", "wrong", "blank", "right", "annulled"]);
  });
});

describe("análises da turma", () => {
  const assessment = makeAssessment();
  const sheets = [
    sheet(1, ["A", "B", "C", "D", null]), // 100%
    sheet(2, ["A", "C", "C", "D", null]), // 75%
    sheet(3, ["B", "C", "A", "D", null]), // 25%
  ];

  it("resume a turma", () => {
    const summary = classSummary(assessment, sheets);
    expect(summary.applied).toBe(3);
    expect(summary.missing).toEqual(["Aluna Quatro"]);
    expect(summary.mean).toBeCloseTo((1 + 0.75 + 0.25) / 3);
    expect(summary.median).toBe(0.75);
    expect(summary.hitRate).toBeCloseTo(8 / 12);
    expect(summary.distribution).toEqual([0, 1, 0, 2]);
    expect(summary.belowThreshold).toBe(1);
  });

  it("ordena as questões mais erradas com o distrator mais marcado e o descritor", () => {
    const [worst, second] = questionStats(assessment, sheets);
    expect(worst).toMatchObject({ number: 2, errorRate: 2 / 3, topDistractor: { choice: "C", share: 2 / 3 } });
    expect(worst?.descriptors.map((d) => d.code)).toEqual(["D1", "D6"]);
    expect(worst?.descriptors[0]?.text).toBe("Localizar informações explícitas em um texto.");
    expect(second?.number).toBe(1);
    // A anulada não entra.
    expect(questionStats(assessment, sheets).map((q) => q.number)).not.toContain(5);
  });

  it("agrega por descritor, do mais frágil ao mais consolidado", () => {
    const stats = descriptorStats(assessment, sheets);
    expect(stats.map((s) => [s.descriptor.code, s.correct, s.attempts, s.level])).toEqual([
      // 50% exatos: em desenvolvimento (crítico é abaixo de 50%).
      ["D1", 3, 6, "developing"],
      ["D6", 3, 6, "developing"],
      ["D3", 3, 3, "consolidated"],
    ]);
    expect(descriptorStats(assessment, [sheets[2] as AnswerSheet])[0]).toMatchObject({ level: "critical" });
  });

  it("lista os alunos críticos com os descritores não consolidados", () => {
    const critical = criticalStudents(assessment, sheets);
    expect(critical).toHaveLength(1);
    expect(critical[0]?.sheet.slot).toBe(3);
    expect(critical[0]?.gaps.map((g) => g.descriptor.code)).toEqual(["D1", "D6"]);
    // Limiar mais alto pega mais alunos.
    expect(criticalStudents({ ...assessment, criticalThreshold: 0.8 }, sheets)).toHaveLength(2);
  });

  it("compara com as avaliações anteriores da turma na mesma disciplina", () => {
    const earlier = makeAssessment({ id: "av-0", code: 2, title: "Diagnóstica", date: "2027-02-10" });
    const otherSubject = makeAssessment({ id: "av-mt", code: 3, subject: "mt", date: "2027-02-20" });
    const all = [assessment, earlier, otherSubject];
    const byId: Record<string, AnswerSheet[]> = {
      "av-1": sheets,
      "av-0": [sheet(1, ["A", "A", "A", "A", null], "av-0")],
      "av-mt": [sheet(1, ["A", "B", "C", "D", null], "av-mt")],
    };
    const history = classHistory(assessment, all, (id) => byId[id] ?? []);
    expect(history.map((h) => [h.title, h.mean])).toEqual([
      ["Diagnóstica", 0.25],
      ["Simulado 1", (1 + 0.75 + 0.25) / 3],
    ]);
  });
});

describe("conferência antes de salvar", () => {
  it("só salva com aluno escolhido e limpa a pendência da questão conferida", () => {
    const assessment = makeAssessment();
    let draft = { ...manualPending(assessment, "p1"), flags: ["ok", "multiple", "ok", "uncertain", "ok"] as MarkFlag[] };
    expect(needsReview(draft.flags)).toEqual([1, 3]);
    expect(toAnswerSheet(draft, assessment, "2027-03-11T00:00:00Z")).toBeNull();
    draft = setAnswer(draft, 1, "B");
    expect(needsReview(draft.flags)).toEqual([3]);
    expect(draft.edited).toBe(true);
    draft = { ...setAnswer(draft, 3, "D"), slot: 2 };
    expect(readyToSave(draft, assessment)).toBe(true);
    expect(toAnswerSheet(draft, assessment, "2027-03-11T00:00:00Z")).toMatchObject({
      slot: 2,
      studentId: "s2",
      studentName: "Aluna Dois",
      answers: [null, "B", null, "D", null],
    });
  });
});

describe("linhas do banco", () => {
  it("converte a avaliação nos dois sentidos", () => {
    const assessment = makeAssessment({ criticalThreshold: 0.55 });
    const row = { ...assessmentToRow("escola-1", assessment), created_at: assessment.createdAt, updated_at: assessment.updatedAt };
    expect(row).toMatchObject({ school_id: "escola-1", applied_on: assessment.date, class_name: "9 ano A", critical_threshold: 0.55 });
    // O PostgREST devolve numeric como texto.
    expect(assessmentFromRow({ ...row, critical_threshold: "0.55" })).toEqual({ ...assessment, criticalThreshold: 0.55 });
  });

  it("converte o cartão e descarta linhas inválidas", () => {
    const original = sheet(2, ["A", null, "C", "D", null]);
    const row = { ...sheetToRow("escola-1", original), scanned_at: original.scannedAt };
    expect(sheetFromRow(row)).toEqual(original);
    expect(sheetFromRow({ ...row, answers: ["Z"] })).toBeNull();
    expect(assessmentFromRow({ id: 1 })).toBeNull();
    expect(rowsOf([row, null, { id: "x" }], sheetFromRow)).toHaveLength(1);
  });
});
