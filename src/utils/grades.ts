import type {
  Classroom,
  GradeResult,
  GradeRow,
  GradeStudent,
  Segment,
  GradeImport,
  Subject,
  Term,
} from "../types/grade";
import { normalizeText } from "./tasks";

export const TERMS: readonly Term[] = [1, 2, 3, 4];

export const SEGMENTS: readonly Segment[] = ["ef1", "ef2"];

/** Título do segmento, como no sistema da rede. */
export const SEGMENT_LABELS: Record<Segment, string> = {
  ef1: "Ensino Fundamental 1º/5º anos",
  ef2: "Ensino Fundamental 6º/9º anos",
};

/** Rótulo curto, para botões. */
export const SEGMENT_SHORT: Record<Segment, string> = {
  ef1: "EF I (1º ao 5º ano)",
  ef2: "EF II (6º ao 9º ano)",
};

/** Média mínima para "APROVADO(A)" no bimestre (a mesma do sistema da rede). */
export const PASSING_MD = 6;

/** Histórico do bimestre pela média; sem média, nenhum. */
export function resultOf(md: number | null): GradeResult | null {
  if (md === null) return null;
  return md >= PASSING_MD ? "approved" : "failed";
}

export const RESULT_LABELS: Record<GradeResult, string> = {
  approved: "APROVADO(A)",
  failed: "REPROVADO(A)",
};

export const termLabel = (term: Term): string => `${term}º bimestre`;

export function isTerm(value: unknown): value is Term {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** Ano da turma ("5 ano A" → 5); sem número, 0. */
export function classGrade(name: string): number {
  const match = /^\s*(\d{1,2})/.exec(name);
  return match ? Number(match[1]) : 0;
}

/** 1º ao 5º ano é o Fundamental I; 6º ao 9º, o II. */
export function segmentOfClass(name: string): Segment {
  const grade = classGrade(name);
  return grade >= 1 && grade <= 5 ? "ef1" : "ef2";
}

/** "5 ano A" → "5º ANO - A" (como no boletim). */
export function classDisplayName(name: string): string {
  const match = /^\s*(\d{1,2})\s*º?\s*ano\s*-?\s*([a-z])?\s*$/i.exec(name);
  if (!match) return name.toUpperCase();
  return `${match[1]}º ANO${match[2] ? ` - ${match[2].toUpperCase()}` : ""}`;
}

/** Ordem natural das turmas: 5 ano A, 5 ano B, 6 ano A… */
export function compareClassrooms(a: Pick<Classroom, "name">, b: Pick<Classroom, "name">): number {
  return classGrade(a.name) - classGrade(b.name) || a.name.localeCompare(b.name, "pt-BR");
}

/** 9.5 → "9,5" · 10 → "10,0" · vazio → "". */
export function formatScore(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  return value.toFixed(1).replace(".", ",");
}

/** "9,5" ou "9.5" → 9.5. Vazio ou fora de 0–10 → `null`. */
export function parseScore(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d+)?$/.test(clean)) return null;
  const value = Math.round(Number(clean) * 10) / 10;
  return value >= 0 && value <= 10 ? value : null;
}

/** dd/mm/aaaa → aaaa-mm-dd. */
const isoFromBr = (day: string, month: string, year: string): string => `${year}-${month}-${day}`;

/** aaaa-mm-dd → dd/mm/aaaa. */
export function brDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return day && month && year ? `${day}/${month}/${year}` : iso;
}

export interface CleanStudentName {
  name: string;
  /** A lista marca "TRF" (transferido), com ou sem a data. */
  transferred: boolean;
  /** YYYY-MM-DD do "TRF dd/mm/aaaa". */
  transferredOn: string | null;
  /** YYYY-MM-DD do "MATR dd/mm/aaaa" (matrícula depois do início do ano). */
  enrolledOn: string | null;
  /** O que vinha depois do nome (ex.: "TEA/AUTISMO"); vazio se nada. */
  notes: string;
}

/** Marca com data opcional, com ou sem hífen antes: " - TRF 04/08/2026", " TRF", " MATR 10/08/2026". */
const mark = (word: string): RegExp =>
  new RegExp(String.raw`\s*-?\s*\b${word}\b(?:\s*(\d{2})\/(\d{2})\/(\d{4}))?\s*`, "i");
const TRF = mark("TRF");
const MATR = mark("MATR");

/** Tira a marca do texto e devolve a data dela (ou "" sem data); `null` se não há marca. */
function takeMark(text: string, pattern: RegExp): { rest: string; date: string | null } | null {
  const match = pattern.exec(text);
  if (!match) return null;
  const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`.trim();
  const date = match[1] && match[2] && match[3] ? isoFromBr(match[1], match[2], match[3]) : "";
  return { rest, date };
}

/**
 * Separa o nome do aluno das marcas que a lista da rede põe junto dele:
 * "ANA SOUZA TRF 04/08/2026" → transferida em 2026-08-04;
 * "JOSÉ LIMA MATR 10/08/2026" → matriculado em 2026-08-10;
 * "JOÃO LIMA - TEA/AUTISMO" → observação "TEA/AUTISMO".
 */
export function splitStudentName(raw: string): CleanStudentName {
  let text = raw.replace(/\s+/g, " ").trim();
  const trf = takeMark(text, TRF);
  if (trf) text = trf.rest;
  const matr = takeMark(text, MATR);
  if (matr) text = matr.rest;
  const [name = "", ...rest] = text.split(/\s+-\s*|\s*-\s+/);
  const notes = rest
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" - ");
  return {
    name: name.trim(),
    transferred: trf !== null,
    transferredOn: trf?.date || null,
    enrolledOn: matr?.date || null,
    notes,
  };
}

/** Chave de comparação de nomes: sem acento, caixa ou espaços sobrando. */
export const nameKey = (value: string): string => normalizeText(value).replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------------------------
// Consulta: agrupa as notas do bimestre em segmento → turma → disciplina.

export interface GradeFilters {
  term: Term;
  /** id da turma, ou "" para todas. */
  classroomId: string;
  /** id da disciplina, ou "" para todas. */
  subjectId: string;
  /** Busca por nome do aluno. */
  query: string;
}

export interface GradeLine {
  row: GradeRow;
  student: GradeStudent;
  result: GradeResult | null;
}

export interface SubjectBlock {
  subject: Subject;
  lines: GradeLine[];
}

export interface ClassBlock {
  classroom: Classroom;
  subjects: SubjectBlock[];
}

export interface SegmentBlock {
  segment: Segment;
  /** "Ensino Fundamental 1º/5º anos – Integral" (o turno das turmas do segmento). */
  title: string;
  classes: ClassBlock[];
}

export interface GradeData {
  classrooms: Classroom[];
  subjects: Subject[];
  students: GradeStudent[];
  imports: GradeImport[];
}

const titleCase = (value: string): string =>
  value.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());

/** Turnos das turmas do segmento: "Integral", ou "Integral/Manhã" se houver mais de um. */
function segmentTitle(segment: Segment, classes: ClassBlock[]): string {
  const shifts = [...new Set(classes.map((block) => titleCase(block.classroom.shift.trim())))].filter(Boolean);
  return shifts.length > 0 ? `${SEGMENT_LABELS[segment]} – ${shifts.join("/")}` : SEGMENT_LABELS[segment];
}

export const sortSubjects = (subjects: Subject[]): Subject[] =>
  [...subjects].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR"));

/**
 * Monta a consulta de um bimestre (`grades` já é só dele): só a turma, a disciplina e os alunos
 * que batem com os filtros. Turmas e disciplinas sem nenhuma linha ficam de fora.
 */
export function groupGrades(data: GradeData, grades: GradeRow[], filters: GradeFilters): SegmentBlock[] {
  const students = new Map(data.students.map((student) => [student.id, student]));
  const needle = nameKey(filters.query);
  const subjects = sortSubjects(data.subjects);
  const rows = grades.filter(
    (row) =>
      row.term === filters.term &&
      (!filters.classroomId || row.classroomId === filters.classroomId) &&
      (!filters.subjectId || row.subjectId === filters.subjectId),
  );

  const classBlocks: ClassBlock[] = [...data.classrooms]
    .sort(compareClassrooms)
    .map((classroom) => ({
      classroom,
      subjects: subjects
        .map((subject) => ({
          subject,
          lines: rows
            .filter((row) => row.classroomId === classroom.id && row.subjectId === subject.id)
            .flatMap((row) => {
              const student = students.get(row.studentId);
              if (!student || (needle && !nameKey(student.name).includes(needle))) return [];
              return [{ row, student, result: resultOf(row.md) }];
            })
            .sort(
              (x, y) =>
                (x.student.rollNumber ?? 999) - (y.student.rollNumber ?? 999) ||
                x.student.name.localeCompare(y.student.name, "pt-BR"),
            ),
        }))
        .filter((block) => block.lines.length > 0),
    }))
    .filter((block) => block.subjects.length > 0);

  return SEGMENTS.map((segment) => {
    const classes = classBlocks.filter((block) => block.classroom.segment === segment);
    return { segment, title: segmentTitle(segment, classes), classes };
  }).filter((block) => block.classes.length > 0);
}
