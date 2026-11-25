/** Áreas deste módulo: só Língua Portuguesa e Matemática. */
export type AssessmentSubject = "lp" | "mt";

/** Alternativa marcada no cartão. */
export type Choice = "A" | "B" | "C" | "D" | "E";

/**
 * Matriz de onde vêm os descritores: Saeb (9º ano), SADEAM (8º ano), CNCA (1º ano) ou da escola.
 */
export type DescriptorMatrix = "saeb9" | "sadeam8" | "cnca1" | "custom";

export interface Descriptor {
  /** Código como na matriz (ex.: "D6", "1EF07_P"). Único dentro da matriz e da disciplina. */
  code: string;
  matrix: DescriptorMatrix;
  subject: AssessmentSubject;
  /** Tópico, tema ou unidade temática da matriz. */
  topic: string;
  text: string;
  /** Habilidade da BNCC correspondente, quando a matriz informa. */
  bncc?: string;
}

export interface AssessmentQuestion {
  /** 1, 2, 3… */
  number: number;
  /** Alternativa correta; `null` = questão anulada (não conta na nota nem nas análises). */
  key: Choice | null;
  descriptorCodes: string[];
}

/** Aluno na avaliação. O `slot` vai impresso (codificado) no cartão nominal. */
export interface RosterEntry {
  /** 1 a 127. Nunca reaproveitado dentro da avaliação. */
  slot: number;
  /** Id no cadastro de alunos (Notas), ou `null` quando o nome foi digitado. */
  studentId: string | null;
  name: string;
  rollNumber: number | null;
}

export interface Assessment {
  id: string;
  /** 1 a 511: impresso no cartão para o leitor saber de qual avaliação ele é. */
  code: number;
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Nome da turma (ex.: "9 ano A"), o mesmo das Notas. */
  className: string;
  /** Turma do cadastro, quando escolhida de lá. */
  classroomId: string | null;
  /** Ano escolar (1 a 9). */
  grade: number;
  subject: AssessmentSubject;
  matrix: DescriptorMatrix;
  alternatives: 4 | 5;
  /** Abaixo deste percentual de acerto (0 a 1) o aluno está em situação crítica. */
  criticalThreshold: number;
  questions: AssessmentQuestion[];
  roster: RosterEntry[];
  /** Descritores próprios da escola (matriz "custom"). */
  customDescriptors: Descriptor[];
  /** ISO. */
  createdAt: string;
  updatedAt: string;
}

/** O que o leitor viu numa questão. */
export type MarkFlag = "ok" | "blank" | "multiple" | "uncertain";

export type SheetSource = "camera" | "image" | "pdf" | "manual";

/** Cartão corrigido: as respostas de um aluno numa avaliação. */
export interface AnswerSheet {
  id: string;
  assessmentId: string;
  /** Slot do aluno na avaliação. */
  slot: number;
  studentId: string | null;
  studentName: string;
  /** Resposta final de cada questão (depois da revisão), na ordem das questões. */
  answers: (Choice | null)[];
  /** O que o leitor encontrou em cada questão (tudo "ok" no lançamento manual). */
  flags: MarkFlag[];
  source: SheetSource;
  /** Alguma resposta foi ajustada à mão na revisão. */
  edited: boolean;
  /** ISO. */
  scannedAt: string;
}
