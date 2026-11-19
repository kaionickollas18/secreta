import type { Classroom, GradeImport, GradeRow, GradeStudent, ReinforcementEntry, Subject } from "../types/grade";
import { isTerm } from "./grades";

/** Conversões das linhas do banco (dado externo). Linha incompleta é descartada (`null`). */

type Row = Record<string, unknown>;

const asRow = (value: unknown): Row | null =>
  typeof value === "object" && value !== null ? (value as Row) : null;
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const isSegment = (value: unknown): value is "ef1" | "ef2" => value === "ef1" || value === "ef2";

/** numeric do Postgres chega como número ou texto ("9.5"). */
function score(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 10 ? Math.round(n * 10) / 10 : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function classroomFromRow(value: unknown): Classroom | null {
  const r = asRow(value);
  if (!r) return null;
  const id = text(r.id);
  const name = text(r.name);
  if (!id || !name || !isSegment(r.segment)) return null;
  return {
    id,
    name,
    segment: r.segment,
    schoolYear: typeof r.school_year === "number" ? r.school_year : 0,
    shift: text(r.shift) || "INTEGRAL",
    teachers: text(r.teachers),
  };
}

export function subjectFromRow(value: unknown): Subject | null {
  const r = asRow(value);
  if (!r) return null;
  const id = text(r.id);
  const name = text(r.name);
  if (!id || !name) return null;
  return { id, name, position: typeof r.position === "number" ? r.position : 0 };
}

export function gradeFromRow(value: unknown): GradeRow | null {
  const r = asRow(value);
  if (!r) return null;
  const studentId = text(r.student_id);
  const classroomId = text(r.classroom_id);
  const subjectId = text(r.subject_id);
  if (!studentId || !classroomId || !subjectId || !isTerm(r.term)) return null;
  return { studentId, classroomId, subjectId, term: r.term, md: score(r.md), ft: count(r.ft) };
}

export function gradeStudentFromRow(value: unknown): GradeStudent | null {
  const r = asRow(value);
  if (!r) return null;
  const id = text(r.id);
  const name = text(r.name);
  if (!id || !name) return null;
  const transferredOn = text(r.transferred_on);
  const transferred = r.status === "transferred";
  return {
    transferred,
    id,
    name,
    className: text(r.class_name),
    registration: text(r.registration),
    rollNumber: count(r.roll_number),
    transferredOn: transferred && /^\d{4}-\d{2}-\d{2}$/.test(transferredOn) ? transferredOn : null,
    notes: text(r.notes),
  };
}

export function gradeImportFromRow(value: unknown): GradeImport | null {
  const r = asRow(value);
  if (!r || !isSegment(r.segment) || !isTerm(r.up_to_term)) return null;
  return {
    segment: r.segment,
    upToTerm: r.up_to_term,
    fileName: text(r.file_name),
    rowCount: typeof r.row_count === "number" ? r.row_count : 0,
    importedByName: text(r.imported_by_name),
    importedAt: text(r.imported_at),
  };
}

/** Aplica a conversão e descarta o que não serviu. */
export function rowsOf<T>(data: unknown, convert: (row: unknown) => T | null): T[] {
  return (Array.isArray(data) ? data : []).map(convert).filter((item): item is T => item !== null);
}

export function reinforcementFromRow(value: unknown): ReinforcementEntry | null {
  const r = asRow(value);
  if (!r) return null;
  const studentId = text(r.student_id);
  if (!studentId) return null;
  return { studentId, note: text(r.note), addedAt: text(r.added_at), addedByName: text(r.added_by_name) };
}
