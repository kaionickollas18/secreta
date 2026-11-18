import type { GradeStudent, Segment } from "../types/grade";
import { nameKey } from "./grades";
import type { ListedClass, ListedStudent, StudentList } from "./studentListParser";
import { findStudent } from "./students";

/**
 * Prévia do envio da lista de matriculados: o que vai ser criado e o que vai ser atualizado
 * no cadastro. O cadastro nunca perde alunos aqui (quem não está na lista continua lá).
 */

/** Linha a gravar em `students`; `id` presente = atualizar o aluno já cadastrado. */
export interface StudentUpsert {
  id?: string;
  className: string;
  student: ListedStudent;
}

export interface ClassroomUpsert {
  name: string;
  segment: Segment;
  shift: string;
  teachers: string;
}

export interface StudentImportPlan {
  schoolYear: number;
  classrooms: ClassroomUpsert[];
  rows: StudentUpsert[];
  created: number;
  updated: number;
  transferred: number;
  /** Alunos do cadastro (no ano) que não estão na lista. */
  notInList: { className: string; name: string }[];
  /** Turmas ignoradas (A.E.E.). */
  skipped: string[];
}

/** Acha o aluno já cadastrado: pela matrícula; senão pelo nome na turma (ou único no ano). */
export function matchListed(
  existing: GradeStudent[],
  className: string,
  student: Pick<ListedStudent, "name" | "registration">,
): GradeStudent | null {
  if (student.registration) {
    const byRegistration = existing.filter((s) => s.registration === student.registration);
    if (byRegistration.length === 1) return byRegistration[0] ?? null;
    const sameClass = byRegistration.find((s) => s.className === className);
    if (sameClass) return sameClass;
  }
  const records = existing.map((s) => ({ ...s, schoolYear: 0 }));
  const exact = records.find((s) => s.className === className && nameKey(s.name) === nameKey(student.name));
  return exact ?? findStudent(records, className, student.name);
}

export function planStudentImport(list: StudentList, existing: GradeStudent[], fallbackYear: number): StudentImportPlan {
  const used = new Set<string>();
  const rows: StudentUpsert[] = [];
  for (const listed of list.classes) {
    for (const student of listed.students) {
      const match = matchListed(existing, listed.className, student);
      // O mesmo aluno do cadastro não pode receber duas linhas da lista.
      const id = match && !used.has(match.id) ? match.id : undefined;
      if (id) used.add(id);
      rows.push({ id, className: listed.className, student });
    }
  }
  const listedKeys = new Set(list.classes.flatMap((c: ListedClass) => c.students.map((s) => `${c.className}|${nameKey(s.name)}`)));
  return {
    schoolYear: list.schoolYear ?? fallbackYear,
    classrooms: list.classes.map((c) => ({ name: c.className, segment: c.segment, shift: c.shift, teachers: c.teachers })),
    rows,
    created: rows.filter((row) => !row.id).length,
    updated: rows.filter((row) => row.id).length,
    transferred: rows.filter((row) => row.student.transferred).length,
    notInList: existing
      .filter((s) => !used.has(s.id) && !listedKeys.has(`${s.className}|${nameKey(s.name)}`))
      .map((s) => ({ className: s.className, name: s.name })),
    skipped: list.skipped,
  };
}
