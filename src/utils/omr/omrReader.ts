import type { Choice, MarkFlag } from "../../types/assessment";
import { decodeCardCode } from "./cardCode";
import {
  BUBBLE_RADIUS,
  CODE_CELL,
  CODE_CELLS,
  cardLayout,
  MARKER_SIZE,
  MARKERS,
  PAPER_SAMPLES,
  type BubblePosition,
  type Point,
} from "./cardLayout";
import { applyHomography, solveHomography, type Homography } from "./homography";

/*
 * Leitor óptico do cartão-resposta (OMR), em funções puras: recebe uma imagem em tons de
 * cinza e devolve o que está marcado. Não depende do navegador (é testado com imagens
 * sintéticas). Para trocar por outro leitor, basta devolver o mesmo `CardReading`.
 */

/** Imagem em tons de cinza: 0 = preto, 255 = branco, linha a linha. */
export interface GrayImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** Converte RGBA (ImageData do canvas) em cinza. */
export function toGray(image: { width: number; height: number; data: Uint8ClampedArray }): GrayImage {
  const { width, height, data } = image;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < gray.length; i += 1, j += 4)
    gray[i] = (data[j] as number) * 0.299 + (data[j + 1] as number) * 0.587 + (data[j + 2] as number) * 0.114;
  return { width, height, data: gray };
}

// ── 1. Achar os quatro quadrados de referência ─────────────────────────────────────────────

interface Blob {
  area: number;
  cx: number;
  cy: number;
}

/** Pixels "escuros" com limiar adaptativo (aguenta sombra e luz desigual da foto). */
function darkMask(img: GrayImage): Uint8Array {
  const { width: w, height: h, data } = img;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let row = 0;
    for (let x = 0; x < w; x += 1) {
      row += data[y * w + x] as number;
      integral[(y + 1) * (w + 1) + x + 1] = (integral[y * (w + 1) + x + 1] as number) + row;
    }
  }
  const half = Math.max(8, Math.round(Math.min(w, h) / 16));
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h, y + half + 1);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w, x + half + 1);
      const sum =
        (integral[y1 * (w + 1) + x1] as number) -
        (integral[y0 * (w + 1) + x1] as number) -
        (integral[y1 * (w + 1) + x0] as number) +
        (integral[y0 * (w + 1) + x0] as number);
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const value = data[y * w + x] as number;
      if (value < mean * 0.8 && value < 170) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/** Manchas sólidas, mais ou menos quadradas, sem tocar a borda da imagem. */
function solidBlobs(img: GrayImage, mask: Uint8Array): Blob[] {
  const { width: w, height: h } = img;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const minArea = Math.pow(Math.min(w, h) * 0.012, 2);
  const maxArea = Math.pow(Math.max(w, h) * 0.12, 2);
  const blobs: Blob[] = [];
  for (let start = 0; start < w * h; start += 1) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let area = 0;
    let sx = 0;
    let sy = 0;
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    while (top > 0) {
      const p = stack[--top] as number;
      const x = p % w;
      const y = (p - x) / w;
      area += 1;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const neighbors = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of neighbors) {
        if (q < 0 || seen[q] || !mask[q]) continue;
        seen[q] = 1;
        stack[top++] = q;
      }
    }
    if (area < minArea || area > maxArea) continue;
    if (minX === 0 || minY === 0 || maxX === w - 1 || maxY === h - 1) continue;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const aspect = bw / bh;
    if (aspect < 0.5 || aspect > 2) continue;
    // Quadrado cheio: entre 50% (girado 45°) e 100% da caixa. Letras e contornos ficam abaixo.
    if (area / (bw * bh) < 0.5) continue;
    blobs.push({ area, cx: sx / area, cy: sy / area });
  }
  return blobs;
}

/**
 * Os quatro quadrados: as maiores manchas sólidas (as bolhas e a faixa de código são bem
 * menores), escolhidas pelos extremos — superior esquerdo, superior direito, inferior direito,
 * inferior esquerdo da imagem. `null` se não houver quatro.
 */
export function findMarkers(img: GrayImage): Point[] | null {
  const blobs = solidBlobs(img, darkMask(img));
  if (blobs.length < 4) return null;
  const maxArea = Math.max(...blobs.map((b) => b.area));
  const big = blobs.filter((b) => b.area >= maxArea * 0.4);
  if (big.length < 4) return null;
  const pick = (score: (b: Blob) => number) => big.reduce((best, b) => (score(b) > score(best) ? b : best));
  const corners = [
    pick((b) => -(b.cx + b.cy)),
    pick((b) => b.cx - b.cy),
    pick((b) => b.cx + b.cy),
    pick((b) => b.cy - b.cx),
  ];
  if (new Set(corners).size !== 4) return null;
  // Quadrilátero com área razoável (não são quatro manchas amontoadas).
  const area =
    Math.abs(
      corners.reduce((sum, p, i) => {
        const q = corners[(i + 1) % 4] as Blob;
        return sum + p.cx * q.cy - q.cx * p.cy;
      }, 0),
    ) / 2;
  if (area < img.width * img.height * 0.08) return null;
  return corners.map((b) => ({ x: b.cx, y: b.cy }));
}

// ── 2. Medir ───────────────────────────────────────────────────────────────────────────────

function sampleAt(img: GrayImage, p: Point): number {
  const x = Math.min(img.width - 1.001, Math.max(0, p.x));
  const y = Math.min(img.height - 1.001, Math.max(0, p.y));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * img.width + x0;
  const d = img.data;
  return (
    (d[i] as number) * (1 - fx) * (1 - fy) +
    (d[i + 1] as number) * fx * (1 - fy) +
    (d[i + img.width] as number) * (1 - fx) * fy +
    (d[i + img.width + 1] as number) * fx * fy
  );
}

/** Pontos de um disco (em mm) ao redor do centro, numa grade 5×5. */
const discOffsets = (radius: number): Point[] => {
  const points: Point[] = [];
  for (let i = -2; i <= 2; i += 1)
    for (let j = -2; j <= 2; j += 1) if (i * i + j * j <= 5) points.push({ x: (i / 2) * radius, y: (j / 2) * radius });
  return points;
};

const BUBBLE_DISC = discOffsets(BUBBLE_RADIUS * 0.6);
const CELL_DISC = discOffsets(CODE_CELL * 0.3);
const MARKER_DISC = discOffsets(MARKER_SIZE * 0.3);

function meanGray(img: GrayImage, h: Homography, center: Point, disc: readonly Point[]): number {
  let sum = 0;
  for (const o of disc) sum += sampleAt(img, applyHomography(h, { x: center.x + o.x, y: center.y + o.y }));
  return sum / disc.length;
}

interface Calibration {
  white: number;
  black: number;
}

function calibrate(img: GrayImage, h: Homography): Calibration {
  const paper = PAPER_SAMPLES.map((p) => sampleAt(img, applyHomography(h, p))).sort((a, b) => a - b);
  const white = paper[Math.floor(paper.length * 0.7)] as number;
  const black = MARKERS.reduce((sum, m) => sum + meanGray(img, h, m, MARKER_DISC), 0) / MARKERS.length;
  return { white, black };
}

/** 0 = papel branco, 1 = tão escuro quanto os quadrados de referência. */
const darkness = (gray: number, c: Calibration): number =>
  Math.max(0, Math.min(1, (c.white - gray) / Math.max(1, c.white - c.black)));

// ── 3. Ler ─────────────────────────────────────────────────────────────────────────────────

/** Marca firme: escurece a bolha pelo menos isto acima de uma bolha vazia. */
export const MARK_LEVEL = 0.3;
/** Abaixo disto é bolha vazia; entre isto e MARK_LEVEL, marca fraca (conferir). */
export const WEAK_LEVEL = 0.14;

export interface QuestionRead {
  /** Alternativa lida (para "uncertain", a mais provável; `null` em branco ou dupla marcação). */
  choice: Choice | null;
  flag: MarkFlag;
  /** Escurecimento de cada alternativa acima da bolha vazia. */
  fills: number[];
}

export interface LocatedCard {
  code: number;
  slot: number;
  homography: Homography;
  calibration: Calibration;
  /** Quadrados de referência na imagem (px). */
  corners: Point[];
}

/** Acha o cartão e lê a faixa de código, testando as quatro orientações. */
export function locateCard(img: GrayImage): LocatedCard | "no-card" | "no-code" {
  const corners = findMarkers(img);
  if (!corners) return "no-card";
  for (let turn = 0; turn < 4; turn += 1) {
    const rotated = corners.map((_, i) => corners[(i + turn) % 4] as Point);
    const h = solveHomography(MARKERS, rotated);
    if (!h) continue;
    const calibration = calibrate(img, h);
    if (calibration.white - calibration.black < 40) continue;
    const bits = CODE_CELLS.map((cell) => (darkness(meanGray(img, h, cell, CELL_DISC), calibration) > 0.5 ? 1 : 0));
    const decoded = decodeCardCode(bits);
    if (decoded) return { ...decoded, homography: h, calibration, corners: rotated };
  }
  return "no-code";
}

export function readBubbles(
  img: GrayImage,
  located: LocatedCard,
  questionCount: number,
  alternatives: 4 | 5,
): { questions: QuestionRead[]; bubbles: (BubblePosition & { px: Point })[] } {
  const layout = cardLayout(questionCount, alternatives);
  const raw = layout.bubbles.map((b) => darkness(meanGray(img, located.homography, b, BUBBLE_DISC), located.calibration));
  // Referência da bolha vazia: a mediana (quase todas as bolhas do cartão estão vazias).
  const baseline = [...raw].sort((a, b) => a - b)[Math.floor(raw.length / 2)] ?? 0;
  const questions: QuestionRead[] = [];
  for (let q = 0; q < layout.questionCount; q += 1) {
    const fills = raw.slice(q * alternatives, (q + 1) * alternatives).map((v) => Math.max(0, v - baseline));
    questions.push({ ...decideMark(fills, alternatives), fills });
  }
  return {
    questions,
    bubbles: layout.bubbles.map((b) => ({ ...b, px: applyHomography(located.homography, b) })),
  };
}

const LETTERS: readonly Choice[] = ["A", "B", "C", "D", "E"];

/** Decide a marcação de uma questão a partir do escurecimento de cada alternativa. */
export function decideMark(fills: readonly number[], alternatives: 4 | 5): Omit<QuestionRead, "fills"> {
  const order = fills
    .slice(0, alternatives)
    .map((value, i) => ({ value, choice: LETTERS[i] as Choice }))
    .sort((a, b) => b.value - a.value);
  const top = order[0];
  const second = order[1];
  if (!top || top.value < WEAK_LEVEL) return { choice: null, flag: "blank" };
  if (top.value < MARK_LEVEL) return { choice: top.choice, flag: "uncertain" };
  if (second && second.value >= MARK_LEVEL) return { choice: null, flag: "multiple" };
  // Outra bolha com marca fraca (rasura ou borracha): só vale se a principal for bem mais forte.
  if (second && second.value >= WEAK_LEVEL && top.value - second.value < 0.25)
    return { choice: top.choice, flag: "uncertain" };
  return { choice: top.choice, flag: "ok" };
}

// ── 4. Cartão inteiro ──────────────────────────────────────────────────────────────────────

export type CardReading =
  | { status: "no-card" | "no-code"; message: string }
  | { status: "unknown-assessment"; message: string; code: number }
  | {
      status: "read";
      assessmentId: string;
      code: number;
      /** Número do aluno impresso no cartão (0 = cartão em branco). */
      slot: number;
      questions: QuestionRead[];
      corners: Point[];
      bubbles: (BubblePosition & { px: Point })[];
    };

export const READING_MESSAGES = {
  "no-card": "Não encontrei os quatro quadrados pretos dos cantos. Enquadre o cartão inteiro, com boa luz.",
  "no-code": "Achei o cartão, mas não consegui ler o código no alto. Tente de novo mais de perto e sem sombra.",
  "unknown-assessment": "Este cartão é de outra avaliação (código {code}).",
} as const;

/**
 * Lê um cartão e o liga à avaliação pelo código impresso. `findAssessment` diz qual avaliação
 * tem aquele código (normalmente só a que está aberta na tela).
 */
export function readAnswerCard(
  img: GrayImage,
  findAssessment: (code: number) => { id: string; questions: readonly unknown[]; alternatives: 4 | 5 } | undefined,
): CardReading {
  const located = locateCard(img);
  if (located === "no-card" || located === "no-code") return { status: located, message: READING_MESSAGES[located] };
  const assessment = findAssessment(located.code);
  if (!assessment)
    return {
      status: "unknown-assessment",
      code: located.code,
      message: READING_MESSAGES["unknown-assessment"].replace("{code}", String(located.code)),
    };
  const { questions, bubbles } = readBubbles(img, located, assessment.questions.length, assessment.alternatives);
  return {
    status: "read",
    assessmentId: assessment.id,
    code: located.code,
    slot: located.slot,
    questions,
    corners: located.corners,
    bubbles,
  };
}
