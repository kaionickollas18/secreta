import type {
  ClassData,
  ClassSummary,
  DayPoint,
  MonthStat,
  RiskLevel,
  StudentReport,
  StudentSummary,
  WeekdayStat,
} from "../types/attendance";

/** LDB: abaixo de 75% de presença o aluno pode reprovar por faltas (mais de 25% de ausência). */
export const RISK_CRITICAL = 0.25;
export const RISK_WARNING = 0.15;
/** Faltas seguidas que pedem contato com a família. */
export const STREAK_ALERT = 3;

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function riskOf(rate: number): RiskLevel {
  if (rate > RISK_CRITICAL) return "critical";
  if (rate >= RISK_WARNING) return "warning";
  return "ok";
}

export function selectClasses(classes: ClassData[], className: string): ClassData[] {
  return className === "all" ? classes : classes.filter((c) => c.name === className);
}

export function summarizeStudents(classes: ClassData[]): StudentSummary[] {
  const result: StudentSummary[] = [];
  for (const cls of classes) {
    const counts = new Map<string, number>();
    for (const record of cls.records) {
      for (const name of record.absent) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const schoolDays = cls.records.length;
    for (const [name, absences] of counts) {
      let streak = 0;
      for (let i = cls.records.length - 1; i >= 0; i -= 1) {
        if (!cls.records[i]?.absent.includes(name)) break;
        streak += 1;
      }
      const rate = schoolDays === 0 ? 0 : absences / schoolDays;
      result.push({
        name,
        className: cls.name,
        absences,
        schoolDays,
        rate,
        streak,
        risk: riskOf(rate),
      });
    }
  }
  return result.sort(
    (a, b) => b.absences - a.absences || a.name.localeCompare(b.name, "pt-BR"),
  );
}

/** "2026-06" -> "Junho de 2026". */
export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const label = new Date(year ?? 0, (m ?? 1) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Resumo de um aluno com a frequência de cada mês em que a turma teve chamada
 * (meses sem falta contam como 100%). `null` se o aluno não tem faltas na turma.
 */
export function studentReport(
  classes: ClassData[],
  className: string,
  name: string,
): StudentReport | null {
  const cls = classes.find((c) => c.name === className);
  const summary = cls && summarizeStudents([cls]).find((s) => s.name === name);
  if (!cls || !summary) return null;

  const byMonth = new Map<string, { schoolDays: number; dates: string[] }>();
  for (const record of cls.records) {
    const key = record.date.slice(0, 7);
    const entry = byMonth.get(key) ?? { schoolDays: 0, dates: [] };
    entry.schoolDays += 1;
    if (record.absent.includes(name)) entry.dates.push(record.date);
    byMonth.set(key, entry);
  }

  const months: MonthStat[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { schoolDays, dates }]) => {
      const absenceRate = dates.length / schoolDays;
      return {
        month,
        label: monthLabel(month),
        schoolDays,
        absences: dates.length,
        presenceRate: 1 - absenceRate,
        risk: riskOf(absenceRate),
        dates: [...dates].sort(),
      };
    });

  // Pior mês: menor frequência; no empate, o que teve mais faltas.
  const worst = months
    .filter((m) => m.absences > 0)
    .sort((a, b) => a.presenceRate - b.presenceRate || b.absences - a.absences)[0];

  return {
    ...summary,
    presenceRate: 1 - summary.rate,
    lastAbsence: months.flatMap((m) => m.dates).pop(),
    months,
    worstMonth: worst?.month,
  };
}

/** Alunos cujo nome contém o texto (sem acento nem caixa), em ordem alfabética. */
export function searchStudents(
  students: StudentSummary[],
  query: string,
  limit = 8,
): StudentSummary[] {
  const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const needle = fold(query.trim());
  if (!needle) return [];
  return students
    .filter((s) => fold(s.name).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.className.localeCompare(b.className, "pt-BR"))
    .slice(0, limit);
}

export function summarizeClasses(classes: ClassData[]): ClassSummary[] {
  return classes.map((cls) => {
    const students = summarizeStudents([cls]);
    const absences = cls.records.reduce((sum, r) => sum + r.absent.length, 0);
    const top = students[0];
    return {
      name: cls.name,
      days: cls.records.length,
      absences,
      avgPerDay: cls.records.length === 0 ? 0 : absences / cls.records.length,
      studentsWithAbsence: students.length,
      critical: students.filter((s) => s.risk === "critical").length,
      topStudent: top ? { name: top.name, absences: top.absences } : undefined,
    };
  });
}

/** Total de faltas por data (somando as turmas) e média móvel de 7 dias de chamada. */
export function dailySeries(classes: ClassData[]): DayPoint[] {
  const totals = new Map<string, number>();
  for (const cls of classes) {
    for (const r of cls.records) totals.set(r.date, (totals.get(r.date) ?? 0) + r.absent.length);
  }
  const dates = [...totals.keys()].sort();
  return dates.map((date, i) => {
    const window = dates.slice(Math.max(0, i - 6), i + 1);
    const sum = window.reduce((acc, d) => acc + (totals.get(d) ?? 0), 0);
    return { date, absences: totals.get(date) ?? 0, average: sum / window.length };
  });
}

export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00`).getDay();
}

export function weekdayStats(series: DayPoint[]): WeekdayStat[] {
  return [1, 2, 3, 4, 5].map((weekday) => {
    const days = series.filter((p) => weekdayOf(p.date) === weekday);
    const total = days.reduce((sum, p) => sum + p.absences, 0);
    return {
      weekday,
      label: WEEKDAY_LABELS[weekday] ?? "",
      avgAbsences: days.length === 0 ? 0 : total / days.length,
      days: days.length,
    };
  });
}

export function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

export function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** Frases de destaque calculadas a partir dos dados. */
export function buildInsights(classes: ClassData[]): string[] {
  const insights: string[] = [];
  const students = summarizeStudents(classes);
  const summaries = summarizeClasses(classes).filter((c) => c.days > 0);
  const series = dailySeries(classes);
  if (series.length === 0) return insights;

  if (summaries.length > 1) {
    const worst = [...summaries].sort((a, b) => b.avgPerDay - a.avgPerDay)[0];
    const best = [...summaries].sort((a, b) => a.avgPerDay - b.avgPerDay)[0];
    if (worst && best) {
      insights.push(
        `${worst.name} tem a maior média de faltas: ${formatNumber(worst.avgPerDay)} por dia. A menor é ${best.name}, com ${formatNumber(best.avgPerDay)}.`,
      );
    }
  }

  const weekdays = weekdayStats(series).filter((w) => w.days > 0);
  const overall = series.reduce((s, p) => s + p.absences, 0) / series.length;
  const peak = [...weekdays].sort((a, b) => b.avgAbsences - a.avgAbsences)[0];
  if (peak && overall > 0) {
    const diff = Math.round((peak.avgAbsences / overall - 1) * 100);
    insights.push(
      `${peak.label}-feira é o dia com mais faltas (${formatNumber(peak.avgAbsences)} por dia${diff > 0 ? `, ${diff}% acima da média` : ""}).`,
    );
  }

  const critical = students.filter((s) => s.risk === "critical");
  if (critical.length > 0) {
    insights.push(
      `${critical.length} ${critical.length === 1 ? "aluno ultrapassou" : "alunos ultrapassaram"} 25% de faltas no período: risco de reprovação por frequência.`,
    );
  }

  const streaking = students.filter((s) => s.streak >= STREAK_ALERT);
  if (streaking.length > 0) {
    insights.push(
      `${streaking.length} ${streaking.length === 1 ? "aluno está" : "alunos estão"} com ${STREAK_ALERT} ou mais faltas seguidas: vale entrar em contato com a família.`,
    );
  }

  const totalAbsences = students.reduce((s, x) => s + x.absences, 0);
  if (students.length >= 10 && totalAbsences > 0) {
    const topCount = Math.max(1, Math.ceil(students.length * 0.1));
    const topShare = students.slice(0, topCount).reduce((s, x) => s + x.absences, 0);
    insights.push(
      `${topCount} ${topCount === 1 ? "aluno concentra" : "alunos concentram"} ${formatPercent(topShare / totalAbsences)} de todas as faltas (10% dos alunos que faltaram).`,
    );
  }

  if (series.length >= 14) {
    const last = series.slice(-7);
    const before = series.slice(-14, -7);
    const avg = (list: typeof series) => list.reduce((s, p) => s + p.absences, 0) / list.length;
    const a = avg(last);
    const b = avg(before);
    if (b > 0) {
      const change = Math.round((a / b - 1) * 100);
      if (Math.abs(change) >= 5) {
        insights.push(
          `Nos últimos 7 dias de chamada, as faltas ${change > 0 ? "subiram" : "caíram"} ${Math.abs(change)}% em relação aos 7 anteriores.`,
        );
      }
    }
  }

  return insights;
}
