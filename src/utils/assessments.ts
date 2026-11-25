import { DESCRIPTOR_CATALOG, defaultMatrix } from "../constants/descriptors";
import type {
  AnswerSheet,
  Assessment,
  AssessmentQuestion,
  AssessmentSubject,
  Choice,
  Descriptor,
  DescriptorMatrix,
  MarkFlag,
  RosterEntry,
  SheetSource,
} from "../types/assessment";

export const CHOICES: readonly Choice[] = ["A", "B", "C", "D", "E"];
/** Máximo de questões que cabem no cartão (3 colunas de 15). */
export const MAX_QUESTIONS = 45;
/** O código da avaliação usa 9 bits no cartão. */
export const MAX_CODE = 511;
/** O número do aluno usa 7 bits no cartão (0 = cartão em branco). */
export const MAX_SLOT = 127;
export const DEFAULT_THRESHOLD = 0.5;

export const choicesFor = (alternatives: 4 | 5): Choice[] => CHOICES.slice(0, alternatives);

// ── Validação de dados externos (o que vem do armazenamento) ───────────────────────────────

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

export const isChoice = (value: unknown): value is Choice => CHOICES.includes(value as Choice);
export const isSubject = (value: unknown): value is AssessmentSubject => value === "lp" || value === "mt";
export const isMatrix = (value: unknown): value is DescriptorMatrix =>
  value === "saeb9" || value === "sadeam8" || value === "cnca1" || value === "custom";
const isFlag = (value: unknown): value is MarkFlag =>
  value === "ok" || value === "blank" || value === "multiple" || value === "uncertain";
const isSource = (value: unknown): value is SheetSource =>
  value === "camera" || value === "image" || value === "pdf" || value === "manual";

function isDescriptor(value: unknown): value is Descriptor {
  return (
    isObject(value) &&
    isString(value.code) &&
    isMatrix(value.matrix) &&
    isSubject(value.subject) &&
    isString(value.topic) &&
    isString(value.text) &&
    (value.bncc === undefined || isString(value.bncc))
  );
}

function isQuestion(value: unknown): value is AssessmentQuestion {
  return (
    isObject(value) &&
    isInt(value.number, 1, MAX_QUESTIONS) &&
    (value.key === null || isChoice(value.key)) &&
    Array.isArray(value.descriptorCodes) &&
    value.descriptorCodes.every(isString)
  );
}

function isRosterEntry(value: unknown): value is RosterEntry {
  return (
    isObject(value) &&
    isInt(value.slot, 1, MAX_SLOT) &&
    (value.studentId === null || isString(value.studentId)) &&
    isString(value.name) &&
    (value.rollNumber === null || isInt(value.rollNumber, 0, 9999))
  );
}

export function isAssessment(value: unknown): value is Assessment {
  return (
    isObject(value) &&
    isString(value.id) &&
    isInt(value.code, 1, MAX_CODE) &&
    isString(value.title) &&
    isString(value.date) &&
    isString(value.className) &&
    (value.classroomId === null || isString(value.classroomId)) &&
    isInt(value.grade, 1, 9) &&
    isSubject(value.subject) &&
    isMatrix(value.matrix) &&
    (value.alternatives === 4 || value.alternatives === 5) &&
    typeof value.criticalThreshold === "number" &&
    value.criticalThreshold >= 0 &&
    value.criticalThreshold <= 1 &&
    Array.isArray(value.questions) &&
    value.questions.every(isQuestion) &&
    Array.isArray(value.roster) &&
    value.roster.every(isRosterEntry) &&
    Array.isArray(value.customDescriptors) &&
    value.customDescriptors.every(isDescriptor) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

export function isAnswerSheet(value: unknown): value is AnswerSheet {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.assessmentId) &&
    isInt(value.slot, 0, MAX_SLOT) &&
    (value.studentId === null || isString(value.studentId)) &&
    isString(value.studentName) &&
    Array.isArray(value.answers) &&
    value.answers.every((a) => a === null || isChoice(a)) &&
    Array.isArray(value.flags) &&
    value.flags.every(isFlag) &&
    isSource(value.source) &&
    typeof value.edited === "boolean" &&
    isString(value.scannedAt)
  );
}

// ── Criação e edição ───────────────────────────────────────────────────────────────────────

/** "9 ano A" → 9; "1º ano B" → 1. Sem número de 1 a 9, `null`. */
export function gradeFromClassName(name: string): number | null {
  const match = /([1-9])\s*(?:º|°|o)?\s*ano/i.exec(name) ?? /^\s*([1-9])\b/.exec(name);
  return match ? Number(match[1]) : null;
}

/** Menor código livre entre as avaliações da escola. */
export function nextCode(existing: readonly Assessment[]): number {
  const used = new Set(existing.map((a) => a.code));
  for (let code = 1; code <= MAX_CODE; code += 1) if (!used.has(code)) return code;
  throw new Error("A escola chegou ao limite de avaliações com cartão. Exclua avaliações antigas.");
}

export function blankQuestions(count: number, current: readonly AssessmentQuestion[] = []): AssessmentQuestion[] {
  return Array.from({ length: count }, (_, i) => current[i] ?? { number: i + 1, key: null, descriptorCodes: [] });
}

interface NewAssessmentInput {
  id: string;
  now: string;
  existing: readonly Assessment[];
  className?: string;
  classroomId?: string | null;
  subject?: AssessmentSubject;
}

export function newAssessment({ id, now, existing, className = "", classroomId = null, subject = "lp" }: NewAssessmentInput): Assessment {
  const grade = gradeFromClassName(className) ?? 9;
  return {
    id,
    code: nextCode(existing),
    title: "",
    date: now.slice(0, 10),
    className,
    classroomId,
    grade,
    subject,
    matrix: defaultMatrix(grade),
    // Saeb e CNCA usam 4 alternativas (A–D); a escola pode passar para 5.
    alternatives: 4,
    criticalThreshold: DEFAULT_THRESHOLD,
    questions: blankQuestions(10),
    roster: [],
    customDescriptors: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Problemas que impedem imprimir ou corrigir. Lista vazia = avaliação pronta. */
export function assessmentProblems(assessment: Assessment): string[] {
  const problems: string[] = [];
  if (!assessment.title.trim()) problems.push("Dê um título à avaliação.");
  if (!assessment.className.trim()) problems.push("Escolha a turma.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(assessment.date)) problems.push("Informe a data.");
  if (assessment.questions.length === 0) problems.push("A avaliação precisa de pelo menos uma questão.");
  if (assessment.questions.length > MAX_QUESTIONS) problems.push(`O cartão comporta até ${MAX_QUESTIONS} questões.`);
  const allowed = choicesFor(assessment.alternatives);
  const noKey = assessment.questions.filter((q) => q.key === null).length;
  if (noKey === assessment.questions.length && noKey > 0) problems.push("Preencha o gabarito.");
  if (assessment.questions.some((q) => q.key !== null && !allowed.includes(q.key)))
    problems.push(`Há gabarito fora das alternativas ${allowed.join(", ")}.`);
  return problems;
}

/** Questões sem descritor (aviso, não impede corrigir). */
export const questionsWithoutDescriptor = (assessment: Assessment): number[] =>
  assessment.questions.filter((q) => q.key !== null && q.descriptorCodes.length === 0).map((q) => q.number);

/**
 * Junta os alunos do cadastro à lista da avaliação: quem já está mantém o número (o cartão
 * impresso continua valendo); quem chegou ganha o próximo número livre. Ninguém é removido.
 */
export function mergeRoster(
  roster: readonly RosterEntry[],
  students: readonly { id: string | null; name: string; rollNumber: number | null }[],
): RosterEntry[] {
  const result = [...roster];
  const byId = new Set(roster.map((r) => r.studentId).filter(Boolean));
  const byName = new Set(roster.map((r) => normalizeName(r.name)));
  let next = roster.reduce((max, r) => Math.max(max, r.slot), 0) + 1;
  const sorted = [...students].sort(
    (a, b) => (a.rollNumber ?? 9999) - (b.rollNumber ?? 9999) || a.name.localeCompare(b.name, "pt-BR"),
  );
  for (const student of sorted) {
    const name = student.name.trim();
    if (!name) continue;
    if (student.id ? byId.has(student.id) : byName.has(normalizeName(name))) continue;
    if (next > MAX_SLOT) break;
    result.push({ slot: next, studentId: student.id, name, rollNumber: student.rollNumber });
    if (student.id) byId.add(student.id);
    byName.add(normalizeName(name));
    next += 1;
  }
  return result;
}

const normalizeName = (name: string): string =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

/** Um nome por linha (colado de uma planilha ou lista). */
export const parseNameList = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[\s.)-]*/, "").trim())
    .filter((line) => line.length > 0);

// ── Descritores ────────────────────────────────────────────────────────────────────────────

/** Descritores disponíveis para a avaliação: os da matriz escolhida, na disciplina dela. */
export function descriptorsFor(assessment: Pick<Assessment, "matrix" | "subject" | "customDescriptors">): Descriptor[] {
  if (assessment.matrix === "custom")
    return assessment.customDescriptors.filter((d) => d.subject === assessment.subject);
  return DESCRIPTOR_CATALOG.filter((d) => d.matrix === assessment.matrix && d.subject === assessment.subject);
}

export function descriptorLookup(assessment: Assessment): Map<string, Descriptor> {
  return new Map(descriptorsFor(assessment).map((d) => [d.code, d]));
}

// ── Correção ───────────────────────────────────────────────────────────────────────────────

export type QuestionOutcome = "right" | "wrong" | "blank" | "annulled";

export interface SheetScore {
  correct: number;
  /** Questões que contam (não anuladas). */
  scored: number;
  /** 0 a 1. */
  percent: number;
  outcomes: QuestionOutcome[];
}

export function scoreSheet(assessment: Assessment, sheet: Pick<AnswerSheet, "answers">): SheetScore {
  let correct = 0;
  let scored = 0;
  const outcomes = assessment.questions.map((question, i): QuestionOutcome => {
    if (question.key === null) return "annulled";
    scored += 1;
    const answer = sheet.answers[i] ?? null;
    if (answer === null) return "blank";
    if (answer === question.key) {
      correct += 1;
      return "right";
    }
    return "wrong";
  });
  return { correct, scored, percent: scored === 0 ? 0 : correct / scored, outcomes };
}

/** Percentual para a tela: 0,734 → "73%". */
export const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;
