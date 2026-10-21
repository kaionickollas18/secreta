import type { ClassData, RiskLevel, StudentSummary, WeekdayStat } from "../types/attendance";
import { buildInsights, dailySeries, summarizeStudents, weekdayStats } from "./attendance";

/**
 * Relatório de frequência de uma turma (documento em PDF): resumo na primeira página e os
 * alunos que mais faltam na segunda. A planilha só registra quem faltou em cada dia, então
 * não há o total de alunos da turma: o relatório fala em faltas e médias, não em % de presença.
 */

/** Quantos alunos entram na lista dos que mais faltam. */
export const TOP_STUDENTS = 10;
/** Quantos destaques cabem na primeira página. */
const MAX_INSIGHTS = 4;

export interface ClassMonth {
  /** YYYY-MM */
  month: string;
  schoolDays: number;
  absences: number;
  avgPerDay: number;
  /** Alunos diferentes que faltaram no mês. */
  studentsAbsent: number;
}

export interface RankedStudent extends StudentSummary {
  /** 1 - rate (0 a 1). */
  presenceRate: number;
  /** YYYY-MM-DD */
  lastAbsence?: string;
}

export interface ClassReport {
  name: string;
  schoolDays: number;
  /** YYYY-MM-DD */
  firstDate?: string;
  lastDate?: string;
  absences: number;
  avgPerDay: number;
  studentsWithAbsence: number;
  /** Alunos que faltaram, por situação. */
  byRisk: Record<RiskLevel, number>;
  /** Dia de chamada com mais faltas. */
  busiestDay?: { date: string; absences: number };
  months: ClassMonth[];
  weekdays: WeekdayStat[];
  insights: string[];
  /** Os que mais faltam (até `TOP_STUDENTS`). */
  top: RankedStudent[];
}

export function classReport(cls: ClassData): ClassReport {
  const records = [...cls.records].sort((a, b) => a.date.localeCompare(b.date));
  const students = summarizeStudents([cls]);
  const absences = records.reduce((sum, r) => sum + r.absent.length, 0);

  const byMonth = new Map<string, { schoolDays: number; absences: number; names: Set<string> }>();
  for (const record of records) {
    const key = record.date.slice(0, 7);
    const entry = byMonth.get(key) ?? { schoolDays: 0, absences: 0, names: new Set<string>() };
    entry.schoolDays += 1;
    entry.absences += record.absent.length;
    for (const name of record.absent) entry.names.add(name);
    byMonth.set(key, entry);
  }
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month,
      schoolDays: m.schoolDays,
      absences: m.absences,
      avgPerDay: m.absences / m.schoolDays,
      studentsAbsent: m.names.size,
    }));

  // Primeiro o dia com mais faltas; no empate, o mais recente.
  const busiest = [...records].sort((a, b) => b.absent.length - a.absent.length || b.date.localeCompare(a.date))[0];

  const lastAbsence = new Map<string, string>();
  for (const record of records) for (const name of record.absent) lastAbsence.set(name, record.date);

  const byRisk: Record<RiskLevel, number> = { critical: 0, warning: 0, ok: 0 };
  for (const s of students) byRisk[s.risk] += 1;

  return {
    name: cls.name,
    schoolDays: records.length,
    firstDate: records[0]?.date,
    lastDate: records[records.length - 1]?.date,
    absences,
    avgPerDay: records.length === 0 ? 0 : absences / records.length,
    studentsWithAbsence: students.length,
    byRisk,
    busiestDay: busiest && busiest.absent.length > 0 ? { date: busiest.date, absences: busiest.absent.length } : undefined,
    months,
    weekdays: weekdayStats(dailySeries([cls])),
    insights: buildInsights([cls]).slice(0, MAX_INSIGHTS),
    top: students.slice(0, TOP_STUDENTS).map((s) => ({
      ...s,
      presenceRate: 1 - s.rate,
      lastAbsence: lastAbsence.get(s.name),
    })),
  };
}

// ───────────────────────── Gráfico de barras: média de faltas por dia em cada mês ─────────────────────────

export interface BarBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const BAR_BOX: BarBox = { width: 900, height: 250, left: 44, right: 16, top: 26, bottom: 30 };

export interface MonthBar {
  month: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  /** A barra do mês com a maior média ganha destaque. */
  peak: boolean;
}

/** Topo "redondo" da escala: 1, 2, 2.5, 5 ou 10 vezes uma potência de 10, acima do maior valor. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value) ?? 10;
  return step * power;
}

export function monthBars(
  months: ClassMonth[],
  box: BarBox = BAR_BOX,
): { bars: MonthBar[]; ticks: { y: number; value: number }[]; baseline: number } {
  const plotWidth = box.width - box.left - box.right;
  const plotHeight = box.height - box.top - box.bottom;
  const baseline = box.top + plotHeight;
  const max = niceMax(Math.max(0, ...months.map((m) => m.avgPerDay)));
  const peak = Math.max(...months.map((m) => m.avgPerDay));
  const slot = months.length === 0 ? plotWidth : plotWidth / months.length;
  const barWidth = Math.min(64, slot * 0.56);
  const round = (n: number) => Math.round(n * 10) / 10;

  const bars = months.map((m, i) => {
    const height = round((m.avgPerDay / max) * plotHeight);
    return {
      month: m.month,
      x: round(box.left + slot * i + (slot - barWidth) / 2),
      y: round(baseline - height),
      width: round(barWidth),
      height,
      value: m.avgPerDay,
      peak: m.avgPerDay > 0 && m.avgPerDay === peak,
    };
  });

  // Grade em passos redondos (1, 2, 5… ou 0,5…), de zero até o topo da escala.
  const step = niceMax(max / 5);
  const ticks: { y: number; value: number }[] = [];
  for (let i = 0; i * step <= max + 1e-9; i += 1) {
    const value = Math.round(i * step * 1000) / 1000;
    ticks.push({ y: round(baseline - (value / max) * plotHeight), value });
  }
  return { bars, ticks, baseline: round(baseline) };
}
