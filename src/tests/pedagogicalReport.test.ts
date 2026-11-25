import { describe, expect, it } from "vitest";
import { DESCRIPTOR_CATALOG } from "../constants/descriptors";
import { teachingTip } from "../constants/teachingTips";
import type { AnswerSheet, Assessment, Choice } from "../types/assessment";
import { descriptorsSheet, exportFileName, responsesSheet, studentsSheet, toCsv } from "../utils/assessmentExport";
import { newAssessment } from "../utils/assessments";
import { buildPedagogicalReport } from "../utils/pedagogicalReport";

// Turma fictícia de 8º ano com a matriz do SADEAM.
function makeAssessment(overrides: Partial<Assessment> = {}): Assessment {
  const base = newAssessment({ id: "av-8", now: "2027-04-10T12:00:00.000Z", existing: [], className: "8 ano A", subject: "lp" });
  return {
    ...base,
    title: "Simulado SADEAM 1",
    questions: [
      { number: 1, key: "A", descriptorCodes: ["D01"] },
      { number: 2, key: "B", descriptorCodes: ["D02"] },
      { number: 3, key: "C", descriptorCodes: ["D02"] },
      { number: 4, key: "D", descriptorCodes: ["D03"] },
      { number: 5, key: "A", descriptorCodes: [] },
    ],
    roster: [1, 2, 3, 4, 5].map((slot) => ({ slot, studentId: null, name: `Aluno ${slot}`, rollNumber: slot })),
    ...overrides,
  };
}

const sheet = (slot: number, answers: (Choice | null)[], assessmentId = "av-8"): AnswerSheet => ({
  id: `s-${assessmentId}-${slot}`,
  assessmentId,
  slot,
  studentId: null,
  studentName: `Aluno ${slot}`,
  answers,
  flags: answers.map(() => "ok"),
  source: "pdf",
  edited: false,
  scannedAt: "2027-04-11T10:00:00.000Z",
});

const assessment = makeAssessment();
// D01 (q1): todos acertam. D02 (q2, q3): quase todos erram, marcando D e A. D03 (q4): metade.
const sheets = [
  sheet(1, ["A", "B", "C", "D", "A"]), // 100%
  sheet(2, ["A", "D", "A", "D", "A"]), // 60%
  sheet(3, ["A", "D", "A", "B", "A"]), // 40%
  sheet(4, ["A", "D", "A", "B", null]), // 20%
];

describe("matriz SADEAM", () => {
  it("é a sugerida para o 8º ano e tem códigos próprios do SADEAM", () => {
    expect(assessment.matrix).toBe("sadeam8");
    const d02 = DESCRIPTOR_CATALOG.find((d) => d.matrix === "sadeam8" && d.subject === "lp" && d.code === "D02");
    expect(d02?.text).toBe("Inferir o sentido de uma palavra ou expressão.");
    const d58 = DESCRIPTOR_CATALOG.find((d) => d.matrix === "sadeam8" && d.subject === "mt" && d.code === "D58");
    expect(d58?.topic).toBe("IV. Tratamento da informação");
  });
});

describe("sugestões por habilidade", () => {
  const tip = (subject: "lp" | "mt", text: string) => teachingTip({ subject, text, topic: "" }).focus;
  it("reconhece a habilidade pelo texto do descritor", () => {
    expect(tip("lp", "Inferir o sentido de uma palavra ou expressão.")).toBe("Vocabulário em contexto");
    expect(tip("lp", "Inferir uma informação implícita em um texto.")).toBe("Inferência");
    expect(tip("lp", "Distinguir um fato da opinião relativa a esse fato.")).toBe("Fato e opinião");
    expect(tip("mt", "Resolver problema que envolva porcentagem.")).toBe("Porcentagem");
    expect(tip("mt", "Resolver problema envolvendo informações apresentadas em tabelas e/ou gráficos.")).toBe("Leitura de tabelas e gráficos");
    expect(tip("mt", "Determinar termos ausentes em sequências de figuras.")).toBe("Padrões e regularidades");
    expect(tip("mt", "Identificar frações equivalentes.")).toBe("Frações e números racionais");
    expect(tip("lp", "Algo que não se parece com nada conhecido")).toBe("Leitura e compreensão");
  });

  it("todo descritor do catálogo recebe uma sugestão específica", () => {
    const generic = DESCRIPTOR_CATALOG.filter((d) => ["Leitura e compreensão", "Retomada do conteúdo"].includes(teachingTip(d).focus));
    expect(generic.map((d) => `${d.matrix} ${d.subject} ${d.code}`)).toEqual([]);
  });
});

describe("devolutiva pedagógica", () => {
  const report = buildPedagogicalReport(assessment, sheets);

  it("prioriza os descritores mais errados, com quem e onde a turma errou", () => {
    expect(report.priorities.map((p) => [p.stat.descriptor.code, Math.round(p.stat.hitRate * 100)])).toEqual([
      ["D02", 25],
      ["D03", 50],
    ]);
    const [first] = report.priorities;
    expect(first?.tip.focus).toBe("Vocabulário em contexto");
    expect(first?.students).toEqual(["Aluno 4", "Aluno 3", "Aluno 2"]);
    expect(first?.distractors).toEqual([
      { question: 2, key: "B", choice: "D", share: 0.75 },
      { question: 3, key: "C", choice: "A", share: 0.75 },
    ]);
    expect(report.strengths.map((s) => s.descriptor.code)).toEqual(["D01"]);
  });

  it("separa os alunos em atenção imediata, em desenvolvimento e monitores", () => {
    expect(report.groups.critical.map((s) => [s.name, s.gaps])).toEqual([
      ["Aluno 4", ["D02", "D03"]],
      ["Aluno 3", ["D02", "D03"]],
    ]);
    expect(report.groups.developing.map((s) => s.name)).toEqual(["Aluno 2"]);
    expect(report.groups.advanced.map((s) => s.name)).toEqual(["Aluno 1"]);
    expect(report.groups.critical[0]?.blank).toBe(1);
  });

  it("escreve a leitura geral e os encaminhamentos com os dados da turma", () => {
    expect(report.overview[0]).toContain("4 alunos da turma 8 ano A (de 5 na lista; 1 ficou sem cartão)");
    expect(report.overview[0]).toContain("média de acertos foi 55%");
    expect(report.overview[1]).toContain("intermediário");
    expect(report.nextSteps[0]).toBe(
      "Retomar com a turma os descritores D02 e D03 nas próximas duas semanas, usando as estratégias sugeridas em cada prioridade.",
    );
    expect(report.nextSteps.join(" ")).toContain("começando por Aluno 4 e Aluno 3");
    expect(report.nextSteps.join(" ")).toContain("Aplicar a avaliação a quem ficou sem cartão: Aluno 5.");
    expect(report.untagged).toEqual([5]);
    expect(report.questionsToRevisit.map((q) => q.number)).toEqual([2, 3, 4]);
  });

  it("compara com a avaliação anterior da mesma turma", () => {
    const earlier = makeAssessment({ id: "av-7", code: 2, title: "Diagnóstica", date: "2027-03-01" });
    const withHistory = buildPedagogicalReport(assessment, sheets, [assessment, earlier], (id) =>
      id === "av-7" ? [sheet(1, ["A", null, null, null, null], "av-7")] : sheets,
    );
    expect(withHistory.overview.join(" ")).toContain('Em relação à avaliação anterior ("Diagnóstica", 01/03/2027), a média subiu 35 pontos percentuais (20% → 55%).');
  });
});

describe("planilhas", () => {
  it("monta a planilha por aluno com nota, situação e cada resposta", () => {
    const rows = studentsSheet(assessment, sheets);
    expect(rows[0]?.slice(0, 10)).toEqual(["Nº", "Aluno", "Acertos", "Questões válidas", "% de acerto", "Em branco", "Situação", "Descritores não consolidados", "Q1", "Q1 certa"]);
    expect(rows[4]?.slice(0, 10)).toEqual([4, "Aluno 4", 1, 5, 20, 1, "Situação crítica", "D02, D03", "A", 1]);
  });

  it("monta a planilha por descritor e a de dados completos (uma linha por resposta e descritor)", () => {
    const byDescriptor = descriptorsSheet(assessment, sheets);
    expect(byDescriptor[1]).toEqual(["D02", "Inferir o sentido de uma palavra ou expressão.", "I. Procedimentos de leitura", "2, 3", 2, 8, 25, "Crítico", "Aluno 2, Aluno 3, Aluno 4"]);
    const responses = responsesSheet(assessment, sheets);
    expect(responses).toHaveLength(1 + 4 * 5);
    expect(responses[2]).toEqual(["Simulado SADEAM 1", "2027-04-10", "8 ano A", 8, "Língua Portuguesa", "SADEAM · 8º ano", 1, "Aluno 1", 2, "B", "B", "Certo", 1, "D02", "Inferir o sentido de uma palavra ou expressão.", "I. Procedimentos de leitura"]);
  });

  it("gera CSV para o Excel em português, sem deixar texto virar fórmula", () => {
    const csv = toCsv([["Nome", "%"], ["=SOMA(A1)", 55.25], ['Diz "oi"; tchau', 3]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("'=SOMA(A1);55,3");
    expect(csv).toContain('"Diz ""oi""; tchau";3');
    expect(exportFileName(makeAssessment({ title: "Prova 1/2", className: "8 ano A" }), "alunos")).toBe("Prova 1-2 - 8 ano A - alunos.csv");
  });
});
