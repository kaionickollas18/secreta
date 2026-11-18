/** Ensino Fundamental I (1º ao 5º ano) ou II (6º ao 9º ano). */
export type Segment = "ef1" | "ef2";

/** Bimestre. */
export type Term = 1 | 2 | 3 | 4;

/** Coluna "Histórico": aprovado ou reprovado no bimestre (pela média). */
export type GradeResult = "approved" | "failed";

export interface Classroom {
  id: string;
  schoolYear: number;
  /** Mesmo nome usado no cadastro dos alunos e no dashboard (ex.: "5 ano A"). */
  name: string;
  segment: Segment;
  /** Como vem no PDF (ex.: "INTEGRAL"). */
  shift: string;
  /** Professores da turma, como na lista de matriculados; vazio se ainda não enviada. */
  teachers: string;
}

export interface Subject {
  id: string;
  name: string;
  /** Ordem do boletim. */
  position: number;
}

/** Média e faltas de um aluno em uma disciplina, num bimestre. */
export interface GradeRow {
  studentId: string;
  classroomId: string;
  subjectId: string;
  term: Term;
  /** Média de 0 a 10, uma casa; `null` = disciplina sem nota ("--" no boletim). */
  md: number | null;
  /** Faltas. */
  ft: number | null;
}

/** O que a tela precisa do aluno ao lado das notas. */
export interface GradeStudent {
  id: string;
  name: string;
  className: string;
  /** Matrícula no sistema da rede, ou vazio. */
  registration: string;
  /** Nº na lista da turma. */
  rollNumber: number | null;
  transferred: boolean;
  /** YYYY-MM-DD da transferência, quando a lista traz a data. */
  transferredOn: string | null;
  notes: string;
}

/** Último envio de boletins de um segmento. */
export interface GradeImport {
  segment: Segment;
  upToTerm: Term;
  fileName: string;
  rowCount: number;
  importedByName: string;
  /** ISO. */
  importedAt: string;
}
