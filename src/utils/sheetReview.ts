import type { AnswerSheet, Assessment, Choice, MarkFlag, SheetSource } from "../types/assessment";
import type { Point } from "./omr/cardLayout";
import type { CardReading } from "./omr/omrReader";

/*
 * Cartão lido (ou lançado à mão) esperando revisão. Só vira `AnswerSheet` quando a pessoa
 * confere e salva: nenhuma leitura automática entra nos resultados sem passar por aqui.
 */

export interface OverlayBubble extends Point {
  question: number;
  choice: Choice;
}

export interface PendingSheet {
  id: string;
  /** De onde veio (ex.: "Página 2, cartão de baixo"). */
  label: string;
  source: SheetSource;
  /** 0 = aluno não identificado (cartão em branco ou lançamento manual). */
  slot: number;
  answers: (Choice | null)[];
  flags: MarkFlag[];
  edited: boolean;
  /** Imagem para conferir, com o tamanho da imagem lida (para desenhar as bolhas por cima). */
  image?: { src: string; width: number; height: number; bubbles: OverlayBubble[] };
}

/** Questões que pedem conferência (em branco não pede: pode ser o aluno que não respondeu). */
export const needsReview = (flags: readonly MarkFlag[]): number[] =>
  flags.flatMap((flag, i) => (flag === "multiple" || flag === "uncertain" ? [i] : []));

export function pendingFromReading(
  reading: Extract<CardReading, { status: "read" }>,
  meta: { id: string; label: string; source: SheetSource; image?: { src: string; width: number; height: number } },
): PendingSheet {
  return {
    id: meta.id,
    label: meta.label,
    source: meta.source,
    slot: reading.slot,
    // Marca fraca entra como sugestão (a mais provável), destacada para conferir.
    answers: reading.questions.map((q) => (q.flag === "ok" || q.flag === "uncertain" ? q.choice : null)),
    flags: reading.questions.map((q) => q.flag),
    edited: false,
    ...(meta.image
      ? {
          image: {
            ...meta.image,
            bubbles: reading.bubbles.map((b) => ({ x: b.px.x, y: b.px.y, question: b.question, choice: b.choice })),
          },
        }
      : {}),
  };
}

export function manualPending(assessment: Assessment, id: string, slot = 0): PendingSheet {
  return {
    id,
    label: "Lançamento manual",
    source: "manual",
    slot,
    answers: assessment.questions.map(() => null),
    flags: assessment.questions.map(() => "ok"),
    edited: false,
  };
}

/** Pronto para salvar sem abrir: aluno identificado e nada para conferir. */
export const readyToSave = (pending: PendingSheet, assessment: Assessment): boolean =>
  assessment.roster.some((r) => r.slot === pending.slot) && needsReview(pending.flags).length === 0;

export function setAnswer(pending: PendingSheet, question: number, choice: Choice | null): PendingSheet {
  const answers = pending.answers.map((a, i) => (i === question ? choice : a));
  // Conferido à mão: a questão deixa de pedir revisão.
  const flags = pending.flags.map((f, i): MarkFlag => (i === question ? "ok" : f));
  return { ...pending, answers, flags, edited: true };
}

export function toAnswerSheet(pending: PendingSheet, assessment: Assessment, now: string): AnswerSheet | null {
  const student = assessment.roster.find((r) => r.slot === pending.slot);
  if (!student) return null;
  return {
    id: pending.id,
    assessmentId: assessment.id,
    slot: student.slot,
    studentId: student.studentId,
    studentName: student.name,
    answers: assessment.questions.map((_, i) => pending.answers[i] ?? null),
    flags: assessment.questions.map((_, i) => pending.flags[i] ?? "ok"),
    source: pending.source,
    edited: pending.edited,
    scannedAt: now,
  };
}

/** Abre um cartão já salvo para rever. */
export const pendingFromSheet = (sheet: AnswerSheet): PendingSheet => ({
  id: sheet.id,
  label: `Cartão salvo de ${sheet.studentName}`,
  source: sheet.source,
  slot: sheet.slot,
  answers: [...sheet.answers],
  flags: [...sheet.flags],
  edited: sheet.edited,
});
