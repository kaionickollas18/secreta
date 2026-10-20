import type { MonthStat, RiskLevel } from "../types/attendance";

/**
 * Gráfico de linha da frequência mês a mês, para o documento do aluno em PDF. Tudo é calculado
 * aqui (pontos, linhas de referência, eixos) e o componente só desenha o SVG.
 */

export interface ChartBox {
  width: number;
  height: number;
  /** Espaço para os rótulos do eixo vertical. */
  left: number;
  right: number;
  top: number;
  /** Espaço para os nomes dos meses. */
  bottom: number;
}

/** `right` deixa espaço para os nomes das linhas de atenção e crítico, fora da área do gráfico. */
export const CHART_BOX: ChartBox = { width: 900, height: 250, left: 44, right: 64, top: 26, bottom: 30 };

/** Presença mínima de cada situação (as mesmas faixas do dashboard: 15% e 25% de faltas). */
export const PRESENCE_LIMITS = [
  { value: 0.85, label: "Atenção" },
  { value: 0.75, label: "Crítico" },
] as const;

export interface ChartPoint {
  x: number;
  y: number;
  value: number;
  /** "ago" ou, quando o período passa de um ano para outro, "ago/26". */
  label: string;
  risk: RiskLevel;
}

export interface PresenceChart {
  points: ChartPoint[];
  /** Caminho SVG da linha. */
  line: string;
  /** Caminho SVG da área sob a linha (até a base do gráfico). */
  area: string;
  /** Linhas de grade do eixo vertical. */
  ticks: { y: number; label: string }[];
  /** Linhas tracejadas de atenção e crítico que cabem na escala. */
  limits: { y: number; label: string }[];
  /** Base do gráfico (y do eixo horizontal). */
  baseline: number;
}

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function parts(month: string): { year: string; name: string } {
  const [year = "", number = "1"] = month.split("-");
  return { year, name: MONTH_NAMES[Number(number) - 1] ?? month };
}

/** "2026-08" -> "ago", ou "ago/26" quando `withYear`. */
export function monthShort(month: string, withYear = false): string {
  const { year, name } = parts(month);
  const short = name.slice(0, 3);
  return withYear ? `${short}/${year.slice(2)}` : short;
}

/** Nome do mês na tabela: "Agosto", ou "Agosto/2026" quando o período passa de um ano. */
export function monthTitle(month: string, withYear = false): string {
  const { year, name } = parts(month);
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  return withYear ? `${title}/${year}` : title;
}

/** Os meses passam de um ano para outro? */
export function spansYears(months: { month: string }[]): boolean {
  return new Set(months.map((m) => m.month.slice(0, 4))).size > 1;
}

/** "fevereiro a outubro de 2026", "novembro de 2025 a março de 2026" ou "junho de 2026". */
export function periodText(months: { month: string }[]): string {
  const first = months[0];
  const last = months[months.length - 1];
  if (!first || !last) return "";
  const a = parts(first.month);
  const b = parts(last.month);
  if (first.month === last.month) return `${a.name} de ${a.year}`;
  return a.year === b.year ? `${a.name} a ${b.name} de ${b.year}` : `${a.name} de ${a.year} a ${b.name} de ${b.year}`;
}

/** Três fatos rápidos sob o gráfico: o melhor e o pior mês e quantos meses ficaram regulares. */
export function monthHighlights(months: MonthStat[]): {
  best?: MonthStat;
  worst?: MonthStat;
  regular: number;
  total: number;
} {
  const ordered = [...months].sort((a, b) => b.presenceRate - a.presenceRate || a.month.localeCompare(b.month));
  return {
    best: ordered[0],
    worst: ordered.length > 1 ? ordered[ordered.length - 1] : undefined,
    regular: months.filter((m) => m.risk === "ok").length,
    total: months.length,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

export function presenceChart(months: MonthStat[], box: ChartBox = CHART_BOX): PresenceChart {
  const plotWidth = box.width - box.left - box.right;
  const plotHeight = box.height - box.top - box.bottom;
  const baseline = box.top + plotHeight;

  // A escala começa um pouco abaixo do pior mês (e nunca acima de 70%), para as diferenças
  // aparecerem sem exagero e as linhas de atenção e crítico ficarem sempre à vista.
  const lowest = Math.min(0.75, ...months.map((m) => m.presenceRate));
  const min = Math.max(0, Math.floor((lowest - 0.05) * 10) / 10);
  const y = (value: number) => round(box.top + (1 - (value - min) / (1 - min)) * plotHeight);
  const x = (index: number) =>
    round(months.length <= 1 ? box.left + plotWidth / 2 : box.left + (index * plotWidth) / (months.length - 1));

  const withYear = spansYears(months);
  const points = months.map((m, index) => ({
    x: x(index),
    y: y(m.presenceRate),
    value: m.presenceRate,
    label: monthShort(m.month, withYear),
    risk: m.risk,
  }));

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area = first && last ? `${line} L${last.x} ${baseline} L${first.x} ${baseline} Z` : "";

  // Grade de 10 em 10 pontos (de 20 em 20 quando a escala é longa).
  const step = 1 - min > 0.5 ? 0.2 : 0.1;
  const ticks: PresenceChart["ticks"] = [];
  for (let value = 1; value >= min - 1e-9; value -= step) {
    ticks.push({ y: y(value), label: `${Math.round(value * 100)}%` });
  }

  return {
    points,
    line,
    area,
    ticks,
    limits: PRESENCE_LIMITS.filter((l) => l.value >= min).map((l) => ({ y: y(l.value), label: l.label })),
    baseline: round(baseline),
  };
}
