import type { AnswerSheet, Assessment, Choice, Descriptor } from "../types/assessment";
import { choicesFor, descriptorLookup, scoreSheet, type SheetScore } from "./assessments";

/*
 * Análises da avaliação. Tudo é calculado na hora a partir do gabarito e dos cartões
 * corrigidos: nada fica guardado e desatualizado.
 */

export type DescriptorLevel = "critical" | "developing" | "consolidated";

/** < 50% crítico; 50–69% em desenvolvimento; ≥ 70% consolidado. */
export function descriptorLevel(hitRate: number): DescriptorLevel {
  if (hitRate < 0.5) return "critical";
  if (hitRate < 0.7) return "developing";
  return "consolidated";
}

export const LEVEL_LABELS: Record<DescriptorLevel, string> = {
  critical: "Crítico",
  developing: "Em desenvolvimento",
  consolidated: "Consolidado",
};

export interface ScoredSheet {
  sheet: AnswerSheet;
  score: SheetScore;
}

export const scoreAll = (assessment: Assessment, sheets: readonly AnswerSheet[]): ScoredSheet[] =>
  sheets.map((sheet) => ({ sheet, score: scoreSheet(assessment, sheet) }));

// ── Turma ──────────────────────────────────────────────────────────────────────────────────

export interface ClassSummary {
  /** Cartões corrigidos. */
  applied: number;
  /** Alunos na lista da avaliação. */
  rosterSize: number;
  /** Alunos da lista sem cartão corrigido. */
  missing: string[];
  /** Média do percentual de acerto (0 a 1). */
  mean: number;
  median: number;
  /** Média de questões certas. */
  meanCorrect: number;
  scoredQuestions: number;
  /** Acertos / respostas de todas as questões que contam. */
  hitRate: number;
  errorRate: number;
  blankRate: number;
  /** Alunos por faixa: 0–24%, 25–49%, 50–74%, 75–100%. */
  distribution: [number, number, number, number];
  belowThreshold: number;
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

export function classSummary(assessment: Assessment, sheets: readonly AnswerSheet[]): ClassSummary {
  const scored = scoreAll(assessment, sheets);
  const percents = scored.map((s) => s.score.percent);
  const scoredQuestions = assessment.questions.filter((q) => q.key !== null).length;
  let right = 0;
  let blank = 0;
  let total = 0;
  const distribution: [number, number, number, number] = [0, 0, 0, 0];
  for (const { score } of scored) {
    for (const outcome of score.outcomes) {
      if (outcome === "annulled") continue;
      total += 1;
      if (outcome === "right") right += 1;
      if (outcome === "blank") blank += 1;
    }
    distribution[Math.min(3, Math.floor(score.percent * 4))] += 1;
  }
  const corrected = new Set(sheets.map((s) => s.slot));
  const n = scored.length;
  return {
    applied: n,
    rosterSize: assessment.roster.length,
    missing: assessment.roster.filter((r) => !corrected.has(r.slot)).map((r) => r.name),
    mean: n ? percents.reduce((a, b) => a + b, 0) / n : 0,
    median: median(percents),
    meanCorrect: n ? scored.reduce((a, s) => a + s.score.correct, 0) / n : 0,
    scoredQuestions,
    hitRate: total ? right / total : 0,
    errorRate: total ? (total - right) / total : 0,
    blankRate: total ? blank / total : 0,
    distribution,
    belowThreshold: scored.filter((s) => s.score.percent < assessment.criticalThreshold).length,
  };
}

// ── Questões ───────────────────────────────────────────────────────────────────────────────

export interface QuestionStat {
  number: number;
  key: Choice;
  descriptors: Descriptor[];
  /** Quantos alunos marcaram cada alternativa. */
  counts: Record<Choice, number>;
  blank: number;
  answered: number;
  hitRate: number;
  /** Erros + em branco, sobre o total de cartões. */
  errorRate: number;
  /** Alternativa errada mais marcada (o distrator mais forte), se alguém errou marcando. */
  topDistractor: { choice: Choice; share: number } | null;
}

/** Estatística de cada questão que conta, da mais errada para a menos errada. */
export function questionStats(assessment: Assessment, sheets: readonly AnswerSheet[]): QuestionStat[] {
  const lookup = descriptorLookup(assessment);
  const choices = choicesFor(assessment.alternatives);
  const total = sheets.length;
  const stats: QuestionStat[] = [];
  assessment.questions.forEach((question, i) => {
    if (question.key === null) return;
    const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 } as Record<Choice, number>;
    let blank = 0;
    for (const sheet of sheets) {
      const answer = sheet.answers[i] ?? null;
      if (answer === null) blank += 1;
      else counts[answer] += 1;
    }
    const right = counts[question.key];
    let topDistractor: QuestionStat["topDistractor"] = null;
    for (const choice of choices) {
      if (choice === question.key || counts[choice] === 0) continue;
      if (!topDistractor || counts[choice] > counts[topDistractor.choice])
        topDistractor = { choice, share: 0 };
    }
    if (topDistractor) topDistractor.share = total ? counts[topDistractor.choice] / total : 0;
    stats.push({
      number: question.number,
      key: question.key,
      descriptors: question.descriptorCodes.map(
        (code) => lookup.get(code) ?? { code, matrix: assessment.matrix, subject: assessment.subject, topic: "", text: "" },
      ),
      counts,
      blank,
      answered: total - blank,
      hitRate: total ? right / total : 0,
      errorRate: total ? (total - right) / total : 0,
      topDistractor,
    });
  });
  return stats.sort((a, b) => b.errorRate - a.errorRate || a.number - b.number);
}

// ── Descritores ────────────────────────────────────────────────────────────────────────────

export interface DescriptorStat {
  descriptor: Descriptor;
  questions: number[];
  /** Respostas avaliadas (alunos × questões do descritor). */
  attempts: number;
  correct: number;
  hitRate: number;
  errorRate: number;
  level: DescriptorLevel;
}

/** Desempenho da turma por descritor, do mais errado para o menos. */
export function descriptorStats(assessment: Assessment, sheets: readonly AnswerSheet[]): DescriptorStat[] {
  const lookup = descriptorLookup(assessment);
  const byCode = new Map<string, DescriptorStat>();
  assessment.questions.forEach((question, i) => {
    if (question.key === null) return;
    for (const code of question.descriptorCodes) {
      let stat = byCode.get(code);
      if (!stat) {
        stat = {
          descriptor: lookup.get(code) ?? { code, matrix: assessment.matrix, subject: assessment.subject, topic: "", text: "" },
          questions: [],
          attempts: 0,
          correct: 0,
          hitRate: 0,
          errorRate: 0,
          level: "critical",
        };
        byCode.set(code, stat);
      }
      stat.questions.push(question.number);
      for (const sheet of sheets) {
        stat.attempts += 1;
        if (sheet.answers[i] === question.key) stat.correct += 1;
      }
    }
  });
  const result = [...byCode.values()].map((stat) => {
    const hitRate = stat.attempts ? stat.correct / stat.attempts : 0;
    return { ...stat, hitRate, errorRate: stat.attempts ? 1 - hitRate : 0, level: descriptorLevel(hitRate) };
  });
  return result.sort((a, b) => b.errorRate - a.errorRate || a.descriptor.code.localeCompare(b.descriptor.code, "pt-BR", { numeric: true }));
}

// ── Alunos ─────────────────────────────────────────────────────────────────────────────────

export interface StudentDescriptorGap {
  descriptor: Descriptor;
  correct: number;
  total: number;
}

export interface StudentResult {
  sheet: AnswerSheet;
  score: SheetScore;
  /** Descritores que o aluno acertou em menos de 50%, os com mais erros primeiro. */
  gaps: StudentDescriptorGap[];
  critical: boolean;
}

export function studentResults(assessment: Assessment, sheets: readonly AnswerSheet[]): StudentResult[] {
  const lookup = descriptorLookup(assessment);
  return scoreAll(assessment, sheets)
    .map(({ sheet, score }) => {
      const tally = new Map<string, { correct: number; total: number }>();
      assessment.questions.forEach((question, i) => {
        if (question.key === null) return;
        for (const code of question.descriptorCodes) {
          const t = tally.get(code) ?? { correct: 0, total: 0 };
          t.total += 1;
          if (score.outcomes[i] === "right") t.correct += 1;
          tally.set(code, t);
        }
      });
      const gaps = [...tally.entries()]
        .filter(([, t]) => t.correct / t.total < 0.5)
        .map(([code, t]) => ({
          descriptor: lookup.get(code) ?? { code, matrix: assessment.matrix, subject: assessment.subject, topic: "", text: "" },
          ...t,
        }))
        .sort((a, b) => b.total - b.correct - (a.total - a.correct) || a.correct / a.total - b.correct / b.total);
      return { sheet, score, gaps, critical: score.percent < assessment.criticalThreshold };
    })
    .sort((a, b) => a.score.percent - b.score.percent || a.sheet.studentName.localeCompare(b.sheet.studentName, "pt-BR"));
}

/** Alunos abaixo do limiar, do pior desempenho para o melhor. */
export const criticalStudents = (assessment: Assessment, sheets: readonly AnswerSheet[]): StudentResult[] =>
  studentResults(assessment, sheets).filter((r) => r.critical);

// ── Comparativo ────────────────────────────────────────────────────────────────────────────

export interface HistoryPoint {
  assessmentId: string;
  title: string;
  date: string;
  mean: number;
  applied: number;
}

/** Avaliações da mesma turma e disciplina (com cartões corrigidos), da mais antiga à mais nova. */
export function classHistory(
  current: Assessment,
  assessments: readonly Assessment[],
  sheetsOf: (assessmentId: string) => readonly AnswerSheet[],
): HistoryPoint[] {
  return assessments
    .filter((a) => a.className === current.className && a.subject === current.subject)
    .map((a) => {
      const summary = classSummary(a, sheetsOf(a.id));
      return { assessmentId: a.id, title: a.title, date: a.date, mean: summary.mean, applied: summary.applied };
    })
    .filter((point) => point.applied > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "pt-BR"));
}
