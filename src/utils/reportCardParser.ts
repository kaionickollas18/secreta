import type { Segment, Term } from "../types/grade";
import { parseScore } from "./grades";
import {
  classNameOf,
  compact,
  groupLines,
  isAeeCourse,
  lineText,
  segmentOfCourse,
  type TextCell,
  type TextItem,
  type TextLine,
} from "./pdfText";

/**
 * Leitor do "Boletim escolar" (PDF do sistema da rede): um boletim por aluno, com a média (MD)
 * e as faltas (FT) de cada disciplina nos quatro bimestres, mais o somatório e a situação final
 * (que não são guardados).
 */

export interface TermScore {
  term: Term;
  /** `null` quando o boletim traz "--". */
  md: number | null;
  ft: number | null;
}

export interface CardSubject {
  name: string;
  terms: TermScore[];
}

export interface ReportCard {
  name: string;
  registration: string;
  /** "Nº Diário". */
  rollNumber: number | null;
  className: string;
  segment: Segment;
  shift: string;
  schoolYear: number | null;
  subjects: CardSubject[];
}

export interface ReportCards {
  cards: ReportCard[];
  /** Boletins ignorados: Atendimento Educacional Especializado ou cabeçalho que não deu para ler. */
  skipped: string[];
}

/** Centro (x) das colunas MD e FT de cada bimestre. */
const MD_X: Record<Term, number> = { 1: 143, 2: 189, 3: 235, 4: 281 };
const FT_X: Record<Term, number> = { 1: 168, 2: 214, 3: 260, 4: 306 };
const TOLERANCE = 12;
const TERM_LIST: Term[] = [1, 2, 3, 4];

const near = (cell: TextCell, x: number) => Math.abs(cell.x - x) <= TOLERANCE;

/** Linha com os números de uma disciplina: tem a coluna MD do 1º bimestre ("9,4" ou "--"). */
function isScoreLine(line: TextLine): boolean {
  return line.cells.some((cell) => near(cell, MD_X[1]) && (cell.text === "--" || parseScore(cell.text) !== null));
}

function scoresOf(line: TextLine): TermScore[] {
  return TERM_LIST.map((term) => {
    const md = line.cells.find((cell) => near(cell, MD_X[term]))?.text ?? "";
    const ft = line.cells.find((cell) => near(cell, FT_X[term]))?.text ?? "";
    return { term, md: md === "--" ? null : parseScore(md), ft: /^\d{1,3}$/.test(ft) ? Number(ft) : null };
  });
}

/** Nome da disciplina: texto na margem esquerda (x < 100). */
const subjectCell = (line: TextLine): TextCell | undefined =>
  line.cells.find((cell) => cell.x < 100 && /\p{L}{2}/u.test(cell.text));

const NOT_SUBJECTS = new Set(["DISCIPLINAS", "ATIVIDADES"]);

interface Header {
  name: string;
  registration: string;
  rollNumber: number | null;
  course: string;
  shift: string;
  series: string;
  group: string;
  schoolYear: number | null;
}

export function parseReportCards(items: TextItem[]): ReportCards {
  const lines = groupLines(items);
  const cards: ReportCard[] = [];
  const skipped: string[] = [];
  let header: Header | null = null;
  let card: ReportCard | null = null;
  let pendingRoll: number | null = null;

  const startCard = () => {
    if (!header) return;
    const segment = segmentOfCourse(header.course);
    const className = classNameOf(header.series, header.group);
    if (isAeeCourse(header.course) || !segment || !className) {
      skipped.push(`${header.name} (${header.course.replace(/\s+/g, " ").trim() || "curso não lido"})`);
      card = null;
      return;
    }
    card = {
      name: header.name,
      registration: header.registration,
      rollNumber: header.rollNumber,
      className,
      segment,
      shift: compact(header.shift) || "INTEGRAL",
      schoolYear: header.schoolYear,
      subjects: [],
    };
    cards.push(card);
  };

  // Nomes de disciplina por página, para achar o mais próximo de cada linha de números.
  const namesByPage = new Map<number, { y: number; name: string }[]>();
  for (const line of lines) {
    const cell = subjectCell(line);
    if (!cell || line.cells[0] !== cell) continue;
    const name = cell.text.replace(/\s+/g, " ").trim();
    if (NOT_SUBJECTS.has(compact(name)) || /^Alun[oa]:/i.test(name) || /^Curso:/i.test(name)) continue;
    const list = namesByPage.get(line.page) ?? [];
    list.push({ y: line.y, name });
    namesByPage.set(line.page, list);
  }

  for (const line of lines) {
    const text = lineText(line);

    const roll = /N[ºo°]\s*Di[áa]rio:\s*(\d+)/i.exec(text);
    if (roll) pendingRoll = Number(roll[1]);

    const student = /Alun[oa]:\s*(.*?)\s*IDCenso:.*?Matr[íi]cula:\s*(\d+)/i.exec(text) ?? /Alun[oa]:\s*(.*?)\s*(?:IDCenso:|$)/i.exec(text);
    if (student && /^Alun[oa]:/i.test(line.cells[0]?.text ?? "")) {
      header = {
        name: (student[1] ?? "").replace(/\s+/g, " ").trim(),
        registration: student[2] ?? "",
        rollNumber: pendingRoll,
        course: "",
        shift: "",
        series: "",
        group: "",
        schoolYear: null,
      };
      pendingRoll = null;
      card = null;
      continue;
    }

    const course = /Curso:\s*(.*?)\s*Turno:\s*(.*?)\s*S[ée]rie:\s*(.*?)\s*Turma:\s*(\S+)/i.exec(text);
    if (course && header) {
      header.course = course[1] ?? "";
      header.shift = course[2] ?? "";
      header.series = course[3] ?? "";
      header.group = course[4] ?? "";
      const year = /Ano\s*Letivo:\s*(\d{4})/i.exec(text);
      header.schoolYear = year ? Number(year[1]) : null;
      startCard();
      continue;
    }

    if (!card || !isScoreLine(line)) continue;
    const names = namesByPage.get(line.page) ?? [];
    let best: { y: number; name: string } | null = null;
    for (const candidate of names) {
      const distance = Math.abs(candidate.y - line.y);
      if (distance <= 4 && (!best || distance < Math.abs(best.y - line.y))) best = candidate;
    }
    if (!best) continue;
    (card as ReportCard).subjects.push({ name: best.name, terms: scoresOf(line) });
  }

  return { cards, skipped };
}

/** Bimestres que têm alguma média ou falta no arquivo. */
export function termsWithData(cards: ReportCard[]): Term[] {
  const found = new Set<Term>();
  for (const card of cards)
    for (const subject of card.subjects)
      for (const score of subject.terms) if (score.md !== null) found.add(score.term);
  return TERM_LIST.filter((term) => found.has(term));
}
