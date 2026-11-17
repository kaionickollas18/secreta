import type { MonthStat, StudentReport } from "../types/attendance";
import type { StudentRecord } from "../types/student";
import { formatDay, formatPercent } from "./attendance";
import { normalizeText } from "./tasks";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Converte a linha do banco (dado externo). Sem nome ou turma, a linha é descartada. */
export function studentFromRow(row: unknown): StudentRecord | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  const name = text(r.name);
  const className = text(r.class_name);
  if (!name || !className) return null;
  const sex = text(r.sex);
  const birthDate = text(r.birth_date);
  return {
    schoolYear: typeof r.school_year === "number" ? r.school_year : 0,
    className,
    name,
    sex: sex === "F" || sex === "M" ? sex : "",
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : "",
    guardianName: text(r.guardian_name),
    guardianNis: text(r.guardian_nis),
    phone: text(r.phone),
    address: text(r.address),
    neighborhood: text(r.neighborhood),
    cep: text(r.cep),
  };
}

/** Sem acento, caixa nem espaços sobrando: a planilha e o cadastro escrevem os nomes de jeitos diferentes. */
const key = (value: string): string => normalizeText(value).replace(/\s+/g, " ").trim();

/**
 * Acha o cadastro do aluno da frequência. Vale a mesma turma e o mesmo nome; se a turma não
 * bater (aluno remanejado), aceita o nome quando ele é único na escola. Com mais de um ano
 * letivo, vence o mais recente.
 */
export function findStudent(records: StudentRecord[], className: string, name: string): StudentRecord | null {
  const wantedName = key(name);
  const wantedClass = key(className);
  const sameName = records
    .filter((record) => key(record.name) === wantedName)
    .sort((a, b) => b.schoolYear - a.schoolYear);
  const exact = sameName.find((record) => key(record.className) === wantedClass);
  if (exact) return exact;
  const latestYear = sameName[0]?.schoolYear;
  const latest = sameName.filter((record) => record.schoolYear === latestYear);
  return latest.length === 1 ? (latest[0] ?? null) : null;
}

/** "Rua das Flores, 10 – Centro" */
export function fullAddress(student: Pick<StudentRecord, "address" | "neighborhood">): string {
  return [student.address, student.neighborhood].filter(Boolean).join(" – ");
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

/** "no mês de julho" · "nos meses de julho e agosto" · "nos meses de julho, agosto e setembro" (só meses com falta). */
export function absenceMonthsText(months: Pick<MonthStat, "month" | "absences">[]): string {
  const names = months
    .filter((month) => month.absences > 0)
    .map((month) => MONTH_NAMES[Number(month.month.slice(5, 7)) - 1])
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return "";
  if (names.length === 1) return `no mês de ${names[0]}`;
  return `nos meses de ${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** "05 faltas escolares" (com zero à esquerda, como no termo da escola). */
export function absencesText(absences: number): string {
  return `${String(absences).padStart(2, "0")} ${absences === 1 ? "falta escolar" : "faltas escolares"}`;
}

const lastOf = <T>(items: readonly T[]): T | undefined => items[items.length - 1];

/** Meses que entram no documento de busca ativa: os escolhidos, já com os números somados. */
export interface BuscaAtivaPeriod {
  /** Meses escolhidos, em ordem. */
  months: MonthStat[];
  absences: number;
  schoolDays: number;
  /** Presenças / dias de chamada nos meses escolhidos (0 a 1). */
  presenceRate: number;
  /** YYYY-MM-DD */
  lastAbsence?: string;
  /** Último dia de chamada da turma dentro dos meses escolhidos (YYYY-MM-DD): "até a data" do termo. */
  countedUntil: string;
}

/** Meses com falta, que podem ser escolhidos para a busca ativa. */
export function absenceMonths(report: StudentReport): MonthStat[] {
  return report.months.filter((month) => month.absences > 0);
}

/** Escolha inicial: o mês mais recente com falta. */
export function defaultBuscaMonths(report: StudentReport): string[] {
  const latest = lastOf(absenceMonths(report));
  return latest ? [latest.month] : [];
}

/**
 * Recorta o relatório nos meses escolhidos (YYYY-MM). `classDates` são os dias de chamada da
 * turma, para achar até que dia as faltas foram contadas. Sem mês válido, devolve `null`.
 */
export function buscaAtivaPeriod(
  report: StudentReport,
  selected: readonly string[],
  classDates: readonly string[],
): BuscaAtivaPeriod | null {
  const months = report.months.filter((month) => selected.includes(month.month));
  if (months.length === 0) return null;
  const absences = months.reduce((sum, month) => sum + month.absences, 0);
  const schoolDays = months.reduce((sum, month) => sum + month.schoolDays, 0);
  const lastAbsence = lastOf(months.flatMap((month) => month.dates).sort());
  const chosen = new Set(months.map((month) => month.month));
  const lastDay = lastOf(classDates.filter((date) => chosen.has(date.slice(0, 7))).sort());
  return {
    months,
    absences,
    schoolDays,
    presenceRate: schoolDays === 0 ? 1 : 1 - absences / schoolDays,
    lastAbsence,
    countedUntil: lastDay ?? lastAbsence ?? `${lastOf(months)?.month ?? ""}-01`,
  };
}

/** Linha de observações do formulário de alerta: a frequência do aluno nos meses escolhidos. */
export function alertNotes(className: string, period: BuscaAtivaPeriod): string {
  const months = absenceMonthsText(period.months);
  const parts = [
    `Turma ${className}`,
    `${period.absences} ${period.absences === 1 ? "falta" : "faltas"}${months ? ` ${months}` : ""} (${period.schoolDays} dias de chamada)`,
    `${formatPercent(period.presenceRate)} de frequência no período`,
  ];
  if (period.lastAbsence) parts.push(`última falta em ${formatDay(period.lastAbsence)}`);
  return parts.join(" · ");
}

/** Espera as imagens carregarem (ou falharem) antes de imprimir; desiste depois de `timeoutMs`. */
export function preloadImages(urls: string[], timeoutMs = 4000): Promise<void> {
  const loads = urls.map(
    (url) =>
      new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = url;
      }),
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([Promise.all(loads).then(() => undefined), timeout]);
}
