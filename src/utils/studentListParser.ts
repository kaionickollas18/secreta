import type { Segment } from "../types/grade";
import { splitStudentName } from "./grades";
import {
  classNameOf,
  compact,
  groupLines,
  isAeeCourse,
  isoDate,
  lineText,
  segmentOfCourse,
  type TextItem,
  type TextLine,
} from "./pdfText";

/**
 * Leitor da "Relação de alunos matriculados por turma" (PDF do sistema da rede): uma turma por
 * página, com curso, turno, série, turma e professores no cabeçalho e uma linha por aluno.
 */

export interface ListedStudent {
  rollNumber: number;
  name: string;
  registration: string;
  /** YYYY-MM-DD, ou vazio. */
  enrolledOn: string;
  birthDate: string;
  sex: "F" | "M" | "";
  transferred: boolean;
  transferredOn: string | null;
  notes: string;
}

export interface ListedClass {
  className: string;
  segment: Segment;
  shift: string;
  teachers: string;
  students: ListedStudent[];
}

export interface StudentList {
  schoolYear: number | null;
  classes: ListedClass[];
  /** Turmas ignoradas (Atendimento Educacional Especializado ou curso desconhecido). */
  skipped: string[];
}

/** Colunas da tabela de alunos (x em pontos, igual em todas as páginas). */
const COLUMNS = [
  { key: "name", from: 50 },
  { key: "registration", from: 243 },
  { key: "enrolledOn", from: 286 },
  { key: "birthDate", from: 323 },
  { key: "age", from: 376 },
  { key: "sex", from: 405 },
  { key: "blood", from: 436 },
  { key: "notes", from: 494 },
] as const;
type Column = (typeof COLUMNS)[number]["key"];

function columnOf(x: number): Column | null {
  let found: Column | null = null;
  for (const column of COLUMNS) if (x >= column.from) found = column.key;
  return found;
}

/** Cabeçalho "Curso: | Turno: | Série: | Turma:" — a linha de baixo traz os valores. */
const isHeaderLabels = (line: TextLine): boolean => {
  const key = compact(lineText(line));
  return key.includes("CURSO:") && key.includes("TURNO:") && key.includes("TURMA:");
};

interface RawRow {
  roll: number;
  parts: Record<Column, string[]>;
}

const emptyParts = (): Record<Column, string[]> => ({
  name: [],
  registration: [],
  enrolledOn: [],
  birthDate: [],
  age: [],
  sex: [],
  blood: [],
  notes: [],
});

function toStudent(row: RawRow): ListedStudent | null {
  const joined = (column: Column) => row.parts[column].join(" ").replace(/\s+/g, " ").trim();
  const clean = splitStudentName(joined("name"));
  if (!clean.name) return null;
  const sex = compact(joined("sex"));
  const registration = joined("registration").replace(/\D/g, "");
  const notes = [clean.notes, joined("notes")].filter(Boolean).join(" - ");
  return {
    rollNumber: row.roll,
    name: clean.name,
    registration,
    enrolledOn: clean.enrolledOn ?? isoDate(joined("enrolledOn")),
    birthDate: isoDate(joined("birthDate")),
    sex: sex === "F" || sex === "M" ? sex : "",
    transferred: clean.transferred,
    transferredOn: clean.transferredOn,
    notes,
  };
}

export function parseStudentList(items: TextItem[]): StudentList {
  const lines = groupLines(items);
  const classes = new Map<string, ListedClass>();
  const skipped = new Set<string>();
  let schoolYear: number | null = null;
  let current: ListedClass | null = null;
  let ignoring = false;
  let row: RawRow | null = null;
  let inTable = false;

  const flush = () => {
    if (row && current && !ignoring) {
      const student = toStudent(row);
      if (student) current.students.push(student);
    }
    row = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as TextLine;
    const text = lineText(line);
    const key = compact(text);

    const year = /EXERC[IÍ]CIO:\s*(\d{4})/i.exec(text);
    if (year) {
      flush();
      inTable = false;
      schoolYear = Number(year[1]);
      continue;
    }

    if (isHeaderLabels(line)) {
      flush();
      inTable = false;
      const labels = line.cells.map((cell) => ({ x: cell.x, label: compact(cell.text) }));
      const values = lines[i + 1];
      i += 1;
      if (!values) break;
      const field: Record<string, string[]> = {};
      // Cada valor fica sob o rótulo mais próximo à esquerda dele.
      for (const cell of values.cells) {
        const label = [...labels].reverse().find((l) => l.x <= cell.x + 6)?.label ?? "";
        (field[label] ??= []).push(cell.text);
      }
      const course = (field["CURSO:"] ?? []).join(" ");
      const segment = segmentOfCourse(course);
      const className = classNameOf((field["SÉRIE:"] ?? field["SERIE:"] ?? []).join(" "), (field["TURMA:"] ?? []).join(" "));
      if (isAeeCourse(course) || isAeeCourse(values.cells.map((c) => c.text).join(" ")) || !segment || !className) {
        ignoring = true;
        current = null;
        skipped.add(values.cells.map((c) => c.text).join(" ").replace(/\s+/g, " "));
        continue;
      }
      ignoring = false;
      current = classes.get(className) ?? {
        className,
        segment,
        shift: (field["TURNO:"] ?? []).join(" ").replace(/\s+/g, "") || "INTEGRAL",
        teachers: "",
        students: [],
      };
      classes.set(className, current);
      continue;
    }

    if (key.startsWith("PROFESSORES")) {
      if (current) current.teachers = text.replace(/^Professores?\s*\(a\)\s*:\s*/i, "").replace(/\s+/g, " ").trim();
      continue;
    }

    // Cabeçalho da tabela: os alunos começam na linha seguinte.
    if (key.startsWith("NºNOME") || key.startsWith("NONOME")) {
      inTable = true;
      continue;
    }
    if (key.startsWith("NºALUNOS") || key.startsWith("NOALUNOS")) {
      flush();
      inTable = false;
      continue;
    }
    if (!inTable) continue;

    const first = line.cells[0];
    const rollCell = first && first.x < 50 && /^\d{1,3}$/.test(first.text) ? first : null;
    if (rollCell) {
      flush();
      row = { roll: Number(rollCell.text), parts: emptyParts() };
    }
    if (!row) continue;
    for (const cell of line.cells) {
      if (cell === rollCell) continue;
      const column = columnOf(cell.x);
      if (column) row.parts[column].push(cell.text);
    }
  }
  flush();

  // A lista às vezes repete o aluno na mesma turma (uma vez sem matrícula): fica um só.
  for (const listed of classes.values()) {
    const byName = new Map<string, ListedStudent>();
    for (const student of listed.students) {
      const k = compact(student.name);
      const seen = byName.get(k);
      if (!seen || (!seen.registration && student.registration)) byName.set(k, student);
    }
    listed.students = [...byName.values()].sort((a, b) => a.rollNumber - b.rollNumber);
  }

  return { schoolYear, classes: [...classes.values()], skipped: [...skipped] };
}
