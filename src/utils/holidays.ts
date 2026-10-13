import type {
  Holiday,
  HolidayFormErrors,
  HolidayFormValues,
  HolidayInput,
  HolidaySource,
} from "../types/calendar";
import { isValidISODate } from "./date";
import { addDays, diffDays } from "./reminders";
import { sanitizeText } from "./validation";

/** Iguais aos limites do banco (`holidays`). */
export const HOLIDAY_LIMITS = { name: 80, days: 92 } as const;

export const HOLIDAY_SOURCE_LABELS: Record<HolidaySource, string> = {
  national: "Feriado nacional",
  optional: "Ponto facultativo",
  school: "Da escola",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Domingo de Páscoa do ano (cálculo gregoriano de Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const FIXED: readonly (readonly [month: number, day: number, name: string])[] = [
  [1, 1, "Confraternização Universal"],
  [4, 21, "Tiradentes"],
  [5, 1, "Dia do Trabalho"],
  [9, 7, "Independência do Brasil"],
  [10, 12, "Nossa Senhora Aparecida"],
  [11, 2, "Finados"],
  [11, 15, "Proclamação da República"],
  [11, 20, "Dia da Consciência Negra"],
  [12, 25, "Natal"],
];

/**
 * Feriados nacionais do ano e os pontos facultativos de data móvel (Carnaval e Corpus
 * Christi). Feriados estaduais e municipais não entram: a escola cadastra os dela.
 */
export function nationalHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const day = (date: string, name: string, source: HolidaySource): Holiday => ({
    id: `${source}-${date}`,
    name,
    start: date,
    end: date,
    source,
  });
  return [
    ...FIXED.map(([m, d, name]) => day(`${year}-${pad(m)}-${pad(d)}`, name, "national")),
    day(addDays(easter, -2), "Sexta-feira Santa", "national"),
    day(addDays(easter, -48), "Carnaval", "optional"),
    day(addDays(easter, -47), "Carnaval", "optional"),
    day(addDays(easter, 60), "Corpus Christi", "optional"),
  ].sort((a, b) => a.start.localeCompare(b.start));
}

interface HolidayRow {
  id: unknown;
  name: unknown;
  starts_on: unknown;
  ends_on: unknown;
}

/** Converte a linha do banco. Devolve `null` se algum campo não for o esperado. */
export function holidayFromRow(row: HolidayRow): Holiday | null {
  const { id, name, starts_on: start, ends_on: end } = row;
  if (typeof id !== "string" || typeof name !== "string") return null;
  if (typeof start !== "string" || typeof end !== "string") return null;
  if (!isValidISODate(start) || !isValidISODate(end) || end < start) return null;
  return { id, name, start, end, source: "school" };
}

export function emptyHolidayForm(date = ""): HolidayFormValues {
  return { name: "", start: date, end: "" };
}

export function holidayToForm(holiday: Holiday): HolidayFormValues {
  return {
    name: holiday.name,
    start: holiday.start,
    end: holiday.end === holiday.start ? "" : holiday.end,
  };
}

export type HolidayValidation =
  | { valid: true; value: HolidayInput }
  | { valid: false; errors: HolidayFormErrors };

/** A data final é opcional: em branco, o feriado dura um dia só. */
export function validateHolidayForm(values: HolidayFormValues): HolidayValidation {
  const errors: HolidayFormErrors = {};
  const name = sanitizeText(values.name);
  const end = values.end === "" ? values.start : values.end;

  if (name.length === 0) errors.name = "Informe o nome do feriado ou recesso.";
  else if (name.length > HOLIDAY_LIMITS.name)
    errors.name = `Use no máximo ${HOLIDAY_LIMITS.name} caracteres no nome.`;

  if (!isValidISODate(values.start)) errors.start = "Informe uma data válida.";
  else if (!isValidISODate(end)) errors.end = "Informe uma data válida ou deixe em branco.";
  else if (end < values.start) errors.end = "O último dia não pode vir antes do primeiro.";
  else if (diffDays(end, values.start) > HOLIDAY_LIMITS.days)
    errors.end = `Um recesso pode ter no máximo ${HOLIDAY_LIMITS.days + 1} dias.`;

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, value: { name, start: values.start, end } };
}
