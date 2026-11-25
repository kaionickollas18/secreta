import type { Choice } from "../../types/assessment";
import { CHOICES, MAX_QUESTIONS } from "../assessments";

/*
 * Geometria do cartão-resposta, em milímetros. É a única fonte: o cartão impresso é desenhado
 * com estes números e o leitor óptico mede nos mesmos pontos. Mudou aqui, muda nos dois.
 *
 * Cartão: A5 deitado (210 × 148 mm), dois por folha A4 em pé.
 */

export interface Point {
  x: number;
  y: number;
}

export const CARD_WIDTH = 210;
export const CARD_HEIGHT = 148;

/** Quadrados pretos de referência nos cantos. */
export const MARKER_SIZE = 8;
const MARKER_INSET = 10;
/** Centros dos quadrados, na ordem: superior esquerdo, superior direito, inferior direito, inferior esquerdo. */
export const MARKERS: readonly Point[] = [
  { x: MARKER_INSET, y: MARKER_INSET },
  { x: CARD_WIDTH - MARKER_INSET, y: MARKER_INSET },
  { x: CARD_WIDTH - MARKER_INSET, y: CARD_HEIGHT - MARKER_INSET },
  { x: MARKER_INSET, y: CARD_HEIGHT - MARKER_INSET },
];

/** Faixa de código: 20 quadradinhos entre os dois marcadores de cima. */
export const CODE_BITS = 20;
export const CODE_CELL = 4;
const CODE_PITCH = 5;
const CODE_START = CARD_WIDTH / 2 - ((CODE_BITS - 1) * CODE_PITCH) / 2;
export const CODE_CELLS: readonly Point[] = Array.from({ length: CODE_BITS }, (_, i) => ({
  x: CODE_START + i * CODE_PITCH,
  y: MARKER_INSET,
}));

/** Pontos sempre em branco (entre a faixa e o cabeçalho): referência do papel. */
export const PAPER_SAMPLES: readonly Point[] = Array.from({ length: 15 }, (_, i) => ({ x: 30 + i * 11, y: 16.5 }));

export const BUBBLE_RADIUS = 2.1;
const BUBBLE_PITCH = 6;
const ROW_PITCH = 5.6;
export const ROWS_PER_COLUMN = 15;
const NUMBER_WIDTH = 9;
const COLUMN_GAP = 8;
/** Linha das letras A B C D (E) acima de cada coluna. */
export const GRID_HEADER_Y = 50;
const FIRST_ROW_Y = 56;

export interface BubblePosition extends Point {
  /** Índice da questão (0 = questão 1). */
  question: number;
  choice: Choice;
}

export interface ColumnLayout {
  /** Centro do número da questão. */
  numberX: number;
  /** Centros das bolhas da linha de letras. */
  header: { x: number; choice: Choice }[];
}

export interface CardLayout {
  questionCount: number;
  alternatives: 4 | 5;
  columns: ColumnLayout[];
  bubbles: BubblePosition[];
  /** Centro do número de cada questão. */
  numbers: (Point & { question: number })[];
}

export function cardLayout(questionCount: number, alternatives: 4 | 5): CardLayout {
  const count = Math.max(1, Math.min(MAX_QUESTIONS, Math.floor(questionCount)));
  const choices = CHOICES.slice(0, alternatives);
  const columnCount = Math.ceil(count / ROWS_PER_COLUMN);
  const columnWidth = NUMBER_WIDTH + alternatives * BUBBLE_PITCH;
  const gridWidth = columnCount * columnWidth + (columnCount - 1) * COLUMN_GAP;
  const left = CARD_WIDTH / 2 - gridWidth / 2;

  const columns: ColumnLayout[] = [];
  const bubbles: BubblePosition[] = [];
  const numbers: CardLayout["numbers"] = [];
  for (let c = 0; c < columnCount; c += 1) {
    const x0 = left + c * (columnWidth + COLUMN_GAP);
    const bubbleX = (i: number) => x0 + NUMBER_WIDTH + BUBBLE_PITCH / 2 + i * BUBBLE_PITCH;
    columns.push({ numberX: x0 + NUMBER_WIDTH / 2, header: choices.map((choice, i) => ({ x: bubbleX(i), choice })) });
    for (let row = 0; row < ROWS_PER_COLUMN; row += 1) {
      const question = c * ROWS_PER_COLUMN + row;
      if (question >= count) break;
      const y = FIRST_ROW_Y + row * ROW_PITCH;
      numbers.push({ x: x0 + NUMBER_WIDTH / 2, y, question });
      choices.forEach((choice, i) => bubbles.push({ x: bubbleX(i), y, question, choice }));
    }
  }
  return { questionCount: count, alternatives, columns, bubbles, numbers };
}
