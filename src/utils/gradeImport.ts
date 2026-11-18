import type { GradeStudent, Segment, Term } from "../types/grade";
import type { ReportCard } from "./reportCardParser";
import { matchListed } from "./studentImport";

/**
 * Prévia do envio dos boletins de um segmento: quais boletins acharam o aluno no cadastro,
 * quais não acharam e as notas que serão gravadas (do 1º até o bimestre escolhido).
 */

export interface GradeUpsert {
  studentId: string;
  className: string;
  subjectName: string;
  term: Term;
  md: number | null;
  ft: number | null;
}

export type CardScore = Omit<GradeUpsert, "studentId" | "className">;

/** Boletim sem aluno no cadastro. Pode ser cadastrado no envio (com as notas dele). */
export interface UnmatchedCard {
  name: string;
  className: string;
  registration: string;
  rollNumber: number | null;
  /** O aluno achado já tinha outro boletim no arquivo: não dá para cadastrar de novo. */
  duplicate: boolean;
  scores: CardScore[];
}

export interface GradeImportPlan {
  segment: Segment;
  upToTerm: Term;
  /** Boletins do segmento escolhido. */
  cards: number;
  matched: number;
  unmatched: UnmatchedCard[];
  /** Boletins de outro segmento (arquivo trocado?). */
  otherSegment: number;
  /** Turmas, com o turno, na ordem do arquivo. */
  classes: { name: string; shift: string }[];
  /** Disciplinas na ordem do boletim. */
  subjects: string[];
  rows: GradeUpsert[];
  /** Bimestres com média no arquivo. */
  termsInFile: Term[];
  /** Bimestres no arquivo depois do escolhido: não entram. */
  ignoredTerms: Term[];
}

export function planGradeImport(
  cards: ReportCard[],
  segment: Segment,
  upToTerm: Term,
  students: GradeStudent[],
): GradeImportPlan {
  const ofSegment = cards.filter((card) => card.segment === segment);
  const classes = new Map<string, string>();
  const subjects: string[] = [];
  const rows: GradeUpsert[] = [];
  const unmatched: UnmatchedCard[] = [];
  const terms = new Set<Term>();
  const usedStudents = new Set<string>();
  let matched = 0;

  for (const card of ofSegment) {
    if (!classes.has(card.className)) classes.set(card.className, card.shift);
    for (const subject of card.subjects) {
      if (!subjects.includes(subject.name)) subjects.push(subject.name);
      for (const score of subject.terms) if (score.md !== null) terms.add(score.term);
    }
    const scores = card.subjects.flatMap((subject) =>
      subject.terms
        .filter((score) => score.term <= upToTerm && (score.md !== null || score.ft !== null))
        .map((score) => ({ subjectName: subject.name, term: score.term, md: score.md, ft: score.ft })),
    );
    const student = matchListed(students, card.className, card);
    // Dois boletins para o mesmo aluno do cadastro: o segundo não entra (fica para conferir).
    if (!student || usedStudents.has(student.id)) {
      unmatched.push({
        name: card.name,
        className: card.className,
        registration: card.registration,
        rollNumber: card.rollNumber,
        duplicate: student !== null,
        scores,
      });
      continue;
    }
    matched += 1;
    usedStudents.add(student.id);
    for (const score of scores) rows.push({ studentId: student.id, className: card.className, ...score });
  }

  const termsInFile = ([1, 2, 3, 4] as Term[]).filter((term) => terms.has(term));
  return {
    segment,
    upToTerm,
    cards: ofSegment.length,
    matched,
    unmatched,
    otherSegment: cards.length - ofSegment.length,
    classes: [...classes].map(([name, shift]) => ({ name, shift })),
    subjects,
    rows,
    termsInFile,
    ignoredTerms: termsInFile.filter((term) => term > upToTerm),
  };
}
