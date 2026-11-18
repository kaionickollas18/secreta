import type { GradeRow, Term } from "../types/grade";
import type { GradeImportPlan } from "../utils/gradeImport";
import type { GradeData } from "../utils/grades";
import {
  classroomFromRow,
  gradeFromRow,
  gradeImportFromRow,
  gradeStudentFromRow,
  rowsOf,
  subjectFromRow,
} from "../utils/gradeRows";
import type { StudentImportPlan } from "../utils/studentImport";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/**
 * Notas bimestrais (`classrooms`, `subjects`, `grades`, `grade_imports`) e o que elas precisam
 * do cadastro dos alunos. Só a secretaria da escola lê e grava (regra no banco).
 */

/** A API devolve no máximo 1000 linhas por pedido: as leituras maiores vêm em páginas. */
const PAGE = 1000;
/** Gravações em lotes, para cada pedido ficar pequeno. */
const BATCH = 400;

const LOAD_FAIL = "Não foi possível carregar as notas.";

type Page = PromiseLike<{ data: unknown[] | null; error: unknown }>;

async function fetchAll(query: (from: number, to: number) => Page): Promise<unknown[] | null> {
  const all: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error || !data) return null;
    all.push(...data);
    if (data.length < PAGE) return all;
  }
}

const chunks = <T>(items: T[], size = BATCH): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

export async function fetchGradeData(schoolId: string, schoolYear: number): Promise<ApiResult<GradeData>> {
  const db = supabase;
  if (!db) return { data: null, error: LOAD_FAIL };
  const [classrooms, subjects, imports, students] = await Promise.all([
    db
      .from("classrooms")
      .select("id, school_year, name, segment, shift, teachers")
      .eq("school_id", schoolId)
      .eq("school_year", schoolYear),
    db.from("subjects").select("id, name, position").eq("school_id", schoolId),
    db
      .from("grade_imports")
      .select("segment, up_to_term, file_name, row_count, imported_by_name, imported_at")
      .eq("school_id", schoolId)
      .eq("school_year", schoolYear),
    fetchAll((from, to) =>
      db
        .from("students")
        .select("id, class_name, name, registration, roll_number, status, transferred_on, notes")
        .eq("school_id", schoolId)
        .eq("school_year", schoolYear)
        .order("id")
        .range(from, to),
    ),
  ]);
  if (classrooms.error || subjects.error || imports.error || !students) return { data: null, error: LOAD_FAIL };
  return {
    data: {
      classrooms: rowsOf(classrooms.data, classroomFromRow),
      subjects: rowsOf(subjects.data, subjectFromRow),
      imports: rowsOf(imports.data, gradeImportFromRow),
      students: rowsOf(students, gradeStudentFromRow),
    },
    error: null,
  };
}

/**
 * Notas de uma turma num bimestre (umas 700 linhas: cabe num pedido só). A página baixa só as
 * turmas que forem abertas, em vez do bimestre inteiro da escola.
 */
export async function fetchClassGrades(
  schoolId: string,
  classroomId: string,
  term: Term,
): Promise<ApiResult<GradeRow[]>> {
  const db = supabase;
  if (!db) return { data: null, error: LOAD_FAIL };
  const rows = await fetchAll((from, to) =>
    db
      .from("grades")
      .select("student_id, classroom_id, subject_id, term, md, ft")
      .eq("school_id", schoolId)
      .eq("classroom_id", classroomId)
      .eq("term", term)
      .order("id")
      .range(from, to),
  );
  if (!rows) return { data: null, error: LOAD_FAIL };
  return { data: rowsOf(rows, gradeFromRow), error: null };
}

/** Todas as notas de um aluno (os quatro bimestres), para o boletim dele. */
export async function fetchStudentGrades(schoolId: string, studentId: string): Promise<ApiResult<GradeRow[]>> {
  if (!supabase) return { data: null, error: "Não foi possível carregar o boletim." };
  const { data, error } = await supabase
    .from("grades")
    .select("student_id, classroom_id, subject_id, term, md, ft")
    .eq("school_id", schoolId)
    .eq("student_id", studentId);
  if (error) return { data: null, error: "Não foi possível carregar o boletim." };
  return { data: rowsOf(data, gradeFromRow), error: null };
}

/** Cria ou atualiza as turmas; devolve o id de cada uma pelo nome. */
async function upsertClassrooms(
  schoolId: string,
  schoolYear: number,
  rows: { name: string; segment: string; shift: string; teachers?: string }[],
): Promise<Map<string, string> | null> {
  if (!supabase || rows.length === 0) return new Map();
  const { data, error } = await supabase
    .from("classrooms")
    .upsert(
      rows.map((row) => ({
        school_id: schoolId,
        school_year: schoolYear,
        name: row.name,
        segment: row.segment,
        shift: row.shift,
        ...(row.teachers !== undefined ? { teachers: row.teachers || null } : {}),
      })),
      { onConflict: "school_id,school_year,name" },
    )
    .select("id, name");
  if (error || !Array.isArray(data)) return null;
  return new Map(data.map((row: { id: string; name: string }) => [row.name, row.id]));
}

const SAVE_LIST_FAIL = "Não foi possível salvar o cadastro dos alunos. Nada foi perdido; tente de novo.";

/** Grava a lista de matriculados: turmas (com professores) e alunos (cria e atualiza). */
export async function saveStudentList(schoolId: string, plan: StudentImportPlan): Promise<string | null> {
  const db = supabase;
  if (!db) return SAVE_LIST_FAIL;
  const classes = await upsertClassrooms(schoolId, plan.schoolYear, plan.classrooms);
  if (!classes) return SAVE_LIST_FAIL;

  const toRow = (row: StudentImportPlan["rows"][number]) => ({
    ...(row.id ? { id: row.id } : {}),
    school_id: schoolId,
    school_year: plan.schoolYear,
    class_name: row.className,
    name: row.student.name,
    roll_number: row.student.rollNumber,
    registration: row.student.registration || null,
    enrolled_on: row.student.enrolledOn || null,
    birth_date: row.student.birthDate || null,
    sex: row.student.sex || null,
    status: row.student.transferred ? "transferred" : "active",
    transferred_on: row.student.transferred ? row.student.transferredOn : null,
    notes: row.student.notes || null,
  });
  // Os já cadastrados são atualizados pelo id (só estas colunas; responsável e endereço ficam).
  for (const batch of chunks(plan.rows.filter((row) => row.id).map(toRow))) {
    const { error } = await db.from("students").upsert(batch, { onConflict: "id" });
    if (error) return SAVE_LIST_FAIL;
  }
  for (const batch of chunks(plan.rows.filter((row) => !row.id).map(toRow))) {
    const { error } = await db
      .from("students")
      .upsert(batch, { onConflict: "school_id,school_year,class_name,name" });
    if (error) return SAVE_LIST_FAIL;
  }
  return null;
}

const SAVE_GRADES_FAIL = "Não foi possível salvar as notas. As notas anteriores continuam como estavam.";

/**
 * Grava os boletins de um segmento, do 1º bimestre até o escolhido (substitui o que havia
 * desses bimestres). Com `registerUnmatched`, cadastra antes os alunos que não foram achados.
 * Devolve quantas notas foram gravadas.
 */
export async function saveGradeImport(
  schoolId: string,
  schoolYear: number,
  plan: GradeImportPlan,
  fileName: string,
  registerUnmatched: boolean,
): Promise<ApiResult<number>> {
  const db = supabase;
  if (!db) return { data: null, error: SAVE_GRADES_FAIL };

  const classes = await upsertClassrooms(
    schoolId,
    schoolYear,
    plan.classes.map((c) => ({ name: c.name, segment: plan.segment, shift: c.shift })),
  );
  const { data: subjectData, error: subjectError } = await db
    .from("subjects")
    .upsert(
      plan.subjects.map((name, position) => ({ school_id: schoolId, name, position })),
      { onConflict: "school_id,name" },
    )
    .select("id, name");
  if (!classes || subjectError || !Array.isArray(subjectData)) return { data: null, error: SAVE_GRADES_FAIL };
  const subjects = new Map(subjectData.map((row: { id: string; name: string }) => [row.name, row.id]));

  const rows = [...plan.rows];
  const toRegister = registerUnmatched ? plan.unmatched.filter((card) => !card.duplicate) : [];
  if (toRegister.length > 0) {
    const { data, error } = await db
      .from("students")
      .upsert(
        toRegister.map((card) => ({
          school_id: schoolId,
          school_year: schoolYear,
          class_name: card.className,
          name: card.name,
          roll_number: card.rollNumber,
          registration: card.registration || null,
        })),
        { onConflict: "school_id,school_year,class_name,name" },
      )
      .select("id, class_name, name");
    if (error || !Array.isArray(data)) return { data: null, error: SAVE_GRADES_FAIL };
    const ids = new Map(data.map((row: { id: string; class_name: string; name: string }) => [`${row.class_name}|${row.name}`, row.id]));
    for (const card of toRegister) {
      const studentId = ids.get(`${card.className}|${card.name}`);
      if (studentId) for (const score of card.scores) rows.push({ studentId, className: card.className, ...score });
    }
  }

  // Formato compacto: posições nas listas de alunos, turmas e disciplinas.
  const studentIds: string[] = [];
  const classroomIds: string[] = [];
  const subjectIds: string[] = [];
  const indexOf = (list: string[], id: string) => {
    const at = list.indexOf(id);
    return at >= 0 ? at : list.push(id) - 1;
  };
  const studentIndex = new Map<string, number>();
  const compactRows: (number | null)[][] = [];
  for (const row of rows) {
    const classroomId = classes.get(row.className);
    const subjectId = subjects.get(row.subjectName);
    if (!classroomId || !subjectId) return { data: null, error: SAVE_GRADES_FAIL };
    let s = studentIndex.get(row.studentId);
    if (s === undefined) {
      s = studentIds.push(row.studentId) - 1;
      studentIndex.set(row.studentId, s);
    }
    compactRows.push([s, indexOf(classroomIds, classroomId), indexOf(subjectIds, subjectId), row.term, row.md, row.ft]);
  }

  const { data, error } = await db.rpc("save_grades", {
    p_school_year: schoolYear,
    p_segment: plan.segment,
    p_up_to_term: plan.upToTerm,
    p_file_name: fileName,
    p_students: studentIds,
    p_classrooms: classroomIds,
    p_subjects: subjectIds,
    p_rows: compactRows,
  });
  if (error) return { data: null, error: SAVE_GRADES_FAIL };
  return { data: typeof data === "number" ? data : compactRows.length, error: null };
}
