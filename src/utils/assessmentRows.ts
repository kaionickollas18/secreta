import type { AnswerSheet, Assessment } from "../types/assessment";
import { isAnswerSheet, isAssessment } from "./assessments";

/*
 * Conversão entre as linhas de `assessments` / `answer_sheets` e o modelo da tela. O que vem do
 * banco é externo: cada linha é validada, e a inválida é descartada (não derruba a página).
 */

type Row = Record<string, unknown>;
const asRow = (value: unknown): Row | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Row) : null;

/** Colunas lidas de `assessments`. */
export const ASSESSMENT_COLUMNS =
  "id, code, title, applied_on, class_name, classroom_id, grade, subject, matrix, alternatives, critical_threshold, questions, roster, custom_descriptors, created_at, updated_at";

/** Colunas lidas de `answer_sheets`. */
export const SHEET_COLUMNS =
  "id, assessment_id, slot, student_id, student_name, answers, flags, source, edited, scanned_at";

export function assessmentFromRow(value: unknown): Assessment | null {
  const r = asRow(value);
  if (!r) return null;
  const candidate = {
    id: r.id,
    code: r.code,
    title: r.title,
    date: r.applied_on,
    className: r.class_name,
    classroomId: r.classroom_id ?? null,
    grade: r.grade,
    subject: r.subject,
    matrix: r.matrix,
    alternatives: r.alternatives,
    // numeric chega como texto ("0.50") pelo PostgREST.
    criticalThreshold: Number(r.critical_threshold),
    questions: r.questions,
    roster: r.roster,
    customDescriptors: r.custom_descriptors,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return isAssessment(candidate) ? candidate : null;
}

export function assessmentToRow(schoolId: string, a: Assessment): Row {
  return {
    id: a.id,
    school_id: schoolId,
    code: a.code,
    title: a.title,
    applied_on: a.date,
    class_name: a.className,
    classroom_id: a.classroomId,
    grade: a.grade,
    subject: a.subject,
    matrix: a.matrix,
    alternatives: a.alternatives,
    critical_threshold: Math.round(a.criticalThreshold * 100) / 100,
    questions: a.questions,
    roster: a.roster,
    custom_descriptors: a.customDescriptors,
  };
}

export function sheetFromRow(value: unknown): AnswerSheet | null {
  const r = asRow(value);
  if (!r) return null;
  const candidate = {
    id: r.id,
    assessmentId: r.assessment_id,
    slot: r.slot,
    studentId: r.student_id ?? null,
    studentName: r.student_name,
    answers: r.answers,
    flags: r.flags,
    source: r.source,
    edited: r.edited,
    scannedAt: r.scanned_at,
  };
  return isAnswerSheet(candidate) ? candidate : null;
}

export function sheetToRow(schoolId: string, s: AnswerSheet): Row {
  return {
    id: s.id,
    school_id: schoolId,
    assessment_id: s.assessmentId,
    slot: s.slot,
    student_id: s.studentId,
    student_name: s.studentName,
    answers: s.answers,
    flags: s.flags,
    source: s.source,
    edited: s.edited,
  };
}

export const rowsOf = <T>(data: unknown, convert: (row: unknown) => T | null): T[] =>
  (Array.isArray(data) ? data : []).map(convert).filter((item): item is T => item !== null);
