import { PRIORITY_LABELS } from "../constants/board";
import type { HistoryEntry } from "../types/task";
import { formatDueDate, todayISO } from "./date";

/** Períodos do histórico, em dias. `0` significa "tudo". */
export const HISTORY_PERIODS = [7, 30, 90, 0] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];
export const DEFAULT_HISTORY_PERIOD: HistoryPeriod = 30;

export function periodLabel(days: HistoryPeriod): string {
  return days === 0 ? "Todo o histórico" : `Últimos ${days} dias`;
}

/** Início do período (ISO), ou `undefined` para "tudo". */
export function periodStart(days: HistoryPeriod, now: Date = new Date()): string | undefined {
  if (days === 0) return undefined;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** ISO 8601 -> DD/MM/AAAA HH:MM no horário local. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Prepara uma célula de CSV: aspas quando necessário e um apóstrofo antes de valores que
 * o Excel interpretaria como fórmula (=, +, -, @), já que o texto vem dos usuários.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Marca de UTF-8 no início do arquivo (o Excel usa para acertar os acentos). */
export const CSV_BOM = String.fromCharCode(0xfeff);

const CSV_HEADER = [
  "Tarefa",
  "Descrição",
  "Prioridade",
  "Responsáveis",
  "Vencimento",
  "Criada em",
  "Concluída em",
  "Concluída por",
];

/** CSV com ponto e vírgula e BOM, que o Excel em português abre direto com os acentos certos. */
export function historyToCsv(entries: HistoryEntry[]): string {
  const rows = entries.map((e) => [
    e.title,
    e.description ?? "",
    PRIORITY_LABELS[e.priority],
    e.assigneeNames.join(", "),
    e.dueDate ? formatDueDate(e.dueDate) : "",
    formatDateTime(e.taskCreatedAt),
    formatDateTime(e.completedAt),
    e.completedByName ?? "",
  ]);
  const lines = [CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(";"));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}

export function historyFileName(days: HistoryPeriod, now: Date = new Date()): string {
  const period = days === 0 ? "completo" : `${days}-dias`;
  return `historico-tarefas-${period}-${todayISO(now)}.csv`;
}
