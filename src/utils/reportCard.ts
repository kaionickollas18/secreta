import type { GradeRow, Subject, Term } from "../types/grade";
import { sortSubjects, TERMS } from "./grades";

/**
 * Boletim de um aluno ("Acompanhamento do estudante"): médias dos quatro bimestres por
 * componente curricular, média, situação e faltas. Participação, desenvolvimento, presenças e
 * faltas justificadas não existem no sistema e saem em branco, para preencher à mão.
 */

/** Legenda da situação, da menor para a maior. */
export type ReportLevel = "developing" | "satisfactory" | "good" | "excellent";

export const REPORT_LEVELS: readonly ReportLevel[] = ["developing", "satisfactory", "good", "excellent"];

export const LEVEL_LABELS: Record<ReportLevel, string> = {
  developing: "Em Desenvolvimento",
  satisfactory: "Satisfatório",
  good: "Bom",
  excellent: "Excelente",
};

/** Abaixo de 6,0 · 6,0 a 7,9 · 8,0 a 8,9 · 9,0 ou mais. */
export function levelOf(average: number | null): ReportLevel | null {
  if (average === null) return null;
  if (average < 6) return "developing";
  if (average < 8) return "satisfactory";
  if (average < 9) return "good";
  return "excellent";
}

export interface ReportSubject {
  name: string;
  /** MD do 1º ao 4º bimestre (`null` = sem nota). */
  terms: (number | null)[];
  /** Soma das médias dos quatro bimestres ÷ 4 (sem nota conta 0), uma casa. */
  average: number | null;
  level: ReportLevel | null;
  /** Faltas (FT) do 1º ao 4º bimestre (`null` = bimestre sem lançamento) e o total. */
  absences: (number | null)[];
  absenceTotal: number | null;
}

/** As atividades sem nota (só faltas), juntas numa linha. */
export interface ReportActivities {
  names: string[];
  absences: (number | null)[];
  absenceTotal: number | null;
}

export interface ReportCardData {
  subjects: ReportSubject[];
  activities: ReportActivities | null;
  /** Parte de cada bimestre no total de faltas (0 a 1); tudo 0 sem faltas. */
  absenceShares: number[];
  /** Bimestres com alguma média. */
  termsWithGrades: Term[];
  /** Todos os quatro bimestres têm média: a média é a final. */
  complete: boolean;
  /** Faltas (soma do FT das disciplinas), por bimestre e no total. */
  absencesByTerm: (number | null)[];
  absences: number;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** "1º bimestre", "1º e 2º bimestres", "1º ao 3º bimestre". */
export function evaluationLabel(terms: Term[]): string {
  if (terms.length === 0) return "";
  if (terms.length === 1) return `${terms[0]}º bimestre`;
  const consecutive = terms.every((term, i) => i === 0 || term === (terms[i - 1] ?? 0) + 1);
  if (consecutive) return terms.length === 2 ? `${terms[0]}º e ${terms[1]}º bimestres` : `${terms[0]}º ao ${terms[terms.length - 1]}º bimestre`;
  return `${terms.map((t) => `${t}º`).join(", ")} bimestres`;
}

/** Monta o boletim com as notas do aluno (todas as linhas dele, de qualquer bimestre). */
export function buildReportCard(grades: GradeRow[], subjects: Subject[]): ReportCardData {
  const withGrades = new Set<Term>();
  const absencesByTerm: (number | null)[] = TERMS.map(() => null);
  for (const row of grades) {
    if (row.md !== null) withGrades.add(row.term);
    if (row.ft !== null) absencesByTerm[row.term - 1] = (absencesByTerm[row.term - 1] ?? 0) + row.ft;
  }

  const rowOf = (subjectId: string, term: Term) =>
    grades.find((row) => row.subjectId === subjectId && row.term === term);
  const sumOf = (values: (number | null)[]): number | null =>
    values.some((value) => value !== null) ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;

  // Componentes com média, cada um com a sua linha. As atividades sem nota ("--" no boletim da
  // rede) ficam juntas numa linha só, com as faltas delas: a folha cabe numa página.
  const present = sortSubjects(subjects).filter((subject) => grades.some((row) => row.subjectId === subject.id));
  const graded = present.filter((subject) => grades.some((row) => row.subjectId === subject.id && row.md !== null));
  const rows: ReportSubject[] = graded.map((subject) => {
    const terms = TERMS.map((term) => rowOf(subject.id, term)?.md ?? null);
    // Média sempre sobre os quatro bimestres: o que ainda não tem nota conta como 0.
    // Ex.: 10, 10 e 10 → (10 + 10 + 10 + 0) / 4 = 7,5.
    const average = round1(terms.reduce<number>((sum, md) => sum + (md ?? 0), 0) / TERMS.length);
    const absences = TERMS.map((term) => rowOf(subject.id, term)?.ft ?? null);
    return { name: subject.name, terms, average, level: levelOf(average), absences, absenceTotal: sumOf(absences) };
  });

  const others = present.filter((subject) => !graded.includes(subject));
  const activityAbsences = TERMS.map((term) => sumOf(others.map((subject) => rowOf(subject.id, term)?.ft ?? null)));
  const activities =
    others.length > 0
      ? { names: others.map((subject) => subject.name), absences: activityAbsences, absenceTotal: sumOf(activityAbsences) }
      : null;

  const absences = absencesByTerm.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const termsWithGrades = TERMS.filter((term) => withGrades.has(term));
  return {
    subjects: rows,
    activities,
    termsWithGrades,
    complete: termsWithGrades.length === TERMS.length,
    absencesByTerm,
    absences,
    absenceShares: absencesByTerm.map((value) => (absences > 0 ? (value ?? 0) / absences : 0)),
  };
}
