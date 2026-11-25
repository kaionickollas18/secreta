import { describe, expect, it } from "vitest";
import type { Choice } from "../types/assessment";
import { decodeCardCode, encodeCardCode } from "../utils/omr/cardCode";
import {
  BUBBLE_RADIUS,
  CARD_HEIGHT,
  CARD_WIDTH,
  CODE_CELL,
  CODE_CELLS,
  cardLayout,
  MARKER_SIZE,
  MARKERS,
  type Point,
} from "../utils/omr/cardLayout";
import { applyHomography, solveHomography } from "../utils/omr/homography";
import { decideMark, readAnswerCard, type GrayImage } from "../utils/omr/omrReader";

/*
 * Imagens sintéticas: desenha o cartão (mesma geometria da impressão) visto por uma câmera
 * qualquer — cada pixel da imagem é levado de volta ao cartão pela homografia inversa.
 */

interface Synthetic {
  code: number;
  slot: number;
  questions: number;
  alternatives: 4 | 5;
  /** Questão → intensidade de cada marca (0 a 1) por alternativa. */
  marks: Record<number, Partial<Record<Choice, number>>>;
  /** Cantos do cartão na imagem (superior esquerdo, superior direito, inferior direito, inferior esquerdo). */
  corners: Point[];
  width?: number;
  height?: number;
}

function render(s: Synthetic): GrayImage {
  const width = s.width ?? 900;
  const height = s.height ?? 700;
  const cardCorners = [
    { x: 0, y: 0 },
    { x: CARD_WIDTH, y: 0 },
    { x: CARD_WIDTH, y: CARD_HEIGHT },
    { x: 0, y: CARD_HEIGHT },
  ];
  const toCard = solveHomography(s.corners, cardCorners);
  if (!toCard) throw new Error("homografia de teste inválida");
  const layout = cardLayout(s.questions, s.alternatives);
  const bits = encodeCardCode(s.code, s.slot);
  // Bolhas agrupadas por milímetro da altura: cada pixel só olha as bolhas da própria linha.
  const rows = new Map<number, typeof layout.bubbles>();
  for (const b of layout.bubbles)
    for (let mm = Math.floor(b.y - 3); mm <= Math.ceil(b.y + 3); mm += 1) rows.set(mm, [...(rows.get(mm) ?? []), b]);
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = applyHomography(toCard, { x, y });
      let value = 95; // mesa
      if (p.x >= 0 && p.x <= CARD_WIDTH && p.y >= 0 && p.y <= CARD_HEIGHT) {
        value = 238 - (p.x / CARD_WIDTH) * 25; // papel com luz desigual
        for (const m of MARKERS)
          if (Math.abs(p.x - m.x) <= MARKER_SIZE / 2 && Math.abs(p.y - m.y) <= MARKER_SIZE / 2) value = 20;
        CODE_CELLS.forEach((c, i) => {
          if (Math.abs(p.x - c.x) <= CODE_CELL / 2 && Math.abs(p.y - c.y) <= CODE_CELL / 2)
            value = bits[i] ? 25 : value - 10;
        });
        for (const b of rows.get(Math.floor(p.y)) ?? []) {
          const d = Math.hypot(p.x - b.x, p.y - b.y);
          if (Math.abs(d - BUBBLE_RADIUS) < 0.18) value = 110; // contorno impresso
          else if (d < BUBBLE_RADIUS * 0.35) value -= 30; // letra dentro da bolha
          const mark = s.marks[b.question]?.[b.choice] ?? 0;
          if (mark > 0 && d < BUBBLE_RADIUS * 0.9) value = 238 - mark * 200;
        }
      }
      data[y * width + x] = value;
    }
  }
  return { width, height, data };
}

const straight: Point[] = [
  { x: 60, y: 70 },
  { x: 840, y: 70 },
  { x: 840, y: 620 },
  { x: 60, y: 620 },
];

const assessment = (questions: number, alternatives: 4 | 5 = 4) => ({
  id: "av-1",
  questions: Array.from({ length: questions }),
  alternatives,
});

describe("código do cartão", () => {
  it("codifica e decodifica avaliação e aluno", () => {
    for (const [code, slot] of [
      [1, 0],
      [37, 12],
      [511, 127],
    ] as const)
      expect(decodeCardCode(encodeCardCode(code, slot))).toEqual({ code, slot });
  });

  it("recusa a faixa com um bit trocado (paridade) ou lida ao contrário", () => {
    const bits = encodeCardCode(37, 12);
    const flipped = [...bits];
    flipped[8] = flipped[8] ? 0 : 1;
    expect(decodeCardCode(flipped)).toBeNull();
    expect(decodeCardCode([...bits].reverse())).toBeNull();
  });
});

describe("decisão de cada questão", () => {
  it("separa marcada, em branco, dupla e fraca", () => {
    expect(decideMark([0.7, 0.02, 0, 0.01], 4)).toEqual({ choice: "A", flag: "ok" });
    expect(decideMark([0.03, 0.02, 0.05, 0.01], 4)).toEqual({ choice: null, flag: "blank" });
    expect(decideMark([0.7, 0.65, 0, 0], 4)).toEqual({ choice: null, flag: "multiple" });
    expect(decideMark([0, 0.2, 0, 0], 4)).toEqual({ choice: "B", flag: "uncertain" });
    // Rasura: a outra bolha ficou meio marcada, mas a principal é bem mais forte.
    expect(decideMark([0.75, 0.2, 0, 0], 4)).toEqual({ choice: "A", flag: "ok" });
    expect(decideMark([0.4, 0.25, 0, 0], 4)).toEqual({ choice: "A", flag: "uncertain" });
  });
});

describe("leitura do cartão", () => {
  const marks: Synthetic["marks"] = { 0: { B: 1 }, 1: { D: 0.9 }, 2: { A: 1 }, 4: { C: 0.95 }, 9: { A: 1 }, 11: { B: 1 } };

  it("lê código, aluno e respostas de um cartão de frente", () => {
    const reading = readAnswerCard(
      render({ code: 37, slot: 12, questions: 12, alternatives: 4, marks, corners: straight }),
      (code) => (code === 37 ? assessment(12) : undefined),
    );
    expect(reading.status).toBe("read");
    if (reading.status !== "read") return;
    expect(reading.slot).toBe(12);
    expect(reading.questions.map((q) => q.choice)).toEqual(["B", "D", "A", null, "C", null, null, null, null, "A", null, "B"]);
    expect(reading.questions[3]?.flag).toBe("blank");
  });

  it("lê foto inclinada, em perspectiva e de cabeça para baixo", () => {
    const tilted: Point[] = [
      { x: 120, y: 90 },
      { x: 820, y: 40 },
      { x: 860, y: 640 },
      { x: 70, y: 600 },
    ];
    const upsideDown: Point[] = [tilted[2], tilted[3], tilted[0], tilted[1]] as Point[];
    for (const corners of [tilted, upsideDown]) {
      const reading = readAnswerCard(
        render({ code: 200, slot: 3, questions: 12, alternatives: 4, marks, corners }),
        () => assessment(12),
      );
      expect(reading.status).toBe("read");
      if (reading.status !== "read") continue;
      expect(reading.slot).toBe(3);
      expect(reading.questions[0]?.choice).toBe("B");
      expect(reading.questions[11]?.choice).toBe("B");
    }
  });

  it("lê cartão em pé (girado 90°) com 45 questões e 5 alternativas", () => {
    const portrait: Point[] = [
      { x: 640, y: 60 },
      { x: 640, y: 860 },
      { x: 60, y: 860 },
      { x: 60, y: 60 },
    ];
    const many: Synthetic["marks"] = { 0: { E: 1 }, 14: { C: 1 }, 15: { A: 1 }, 44: { D: 1 } };
    const reading = readAnswerCard(
      render({ code: 5, slot: 99, questions: 45, alternatives: 5, marks: many, corners: portrait, width: 700, height: 920 }),
      () => assessment(45, 5),
    );
    expect(reading.status).toBe("read");
    if (reading.status !== "read") return;
    expect(reading.slot).toBe(99);
    expect([0, 14, 15, 44].map((q) => reading.questions[q]?.choice)).toEqual(["E", "C", "A", "D"]);
    expect(reading.questions.filter((q) => q.flag === "ok")).toHaveLength(4);
  });

  it("aponta dupla marcação e marca fraca para conferir", () => {
    const reading = readAnswerCard(
      render({
        code: 9,
        slot: 1,
        questions: 5,
        alternatives: 4,
        marks: { 0: { A: 1, C: 1 }, 1: { B: 0.3 }, 2: { D: 1 } },
        corners: straight,
      }),
      () => assessment(5),
    );
    expect(reading.status).toBe("read");
    if (reading.status !== "read") return;
    expect(reading.questions[0]?.flag).toBe("multiple");
    expect(reading.questions[1]?.flag).toBe("uncertain");
    expect(reading.questions[1]?.choice).toBe("B");
    expect(reading.questions[2]).toMatchObject({ choice: "D", flag: "ok" });
  });

  it("avisa quando não há cartão ou o cartão é de outra avaliação", () => {
    const blank: GrayImage = { width: 300, height: 200, data: new Uint8ClampedArray(300 * 200).fill(230) };
    expect(readAnswerCard(blank, () => assessment(5)).status).toBe("no-card");
    const other = readAnswerCard(
      render({ code: 77, slot: 1, questions: 5, alternatives: 4, marks: {}, corners: straight }),
      () => undefined,
    );
    expect(other).toMatchObject({ status: "unknown-assessment", code: 77 });
  });
});
