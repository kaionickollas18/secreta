import type { TaskStatus } from "../types/task";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data local de hoje em YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidISODate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isOverdue(
  dueDate: string | undefined,
  status: TaskStatus,
  today: string = todayISO(),
): boolean {
  return dueDate !== undefined && dueDate !== "" && status !== "done" && dueDate < today;
}

/** YYYY-MM-DD -> DD/MM/YYYY (sem passar por Date, evitando problemas de fuso). */
export function formatDueDate(iso: string): string {
  const match = ISO_DATE.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
