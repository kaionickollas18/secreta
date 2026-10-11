import type { AttendanceData, ClassData } from "../types/attendance";
import { parseClassCsv } from "./sheetParser";

export const MAX_CLASSES = 60;
/** Limite por arquivo CSV enviado. */
export const MAX_CSV_BYTES = 2 * 1024 * 1024;

/** Id da planilha a partir do link do Google Sheets, ou `null` se o link não for de uma planilha. */
export function extractSheetId(url: string): string | null {
  const match = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(url.trim());
  return match?.[1] ?? null;
}

/** Uma turma por linha: apara, ignora vazias e repetidas. */
export function parseClassNames(text: string): string[] {
  const names = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [...new Set(names)];
}

export interface SheetForm {
  sheetUrl: string;
  /** Texto do campo, uma turma por linha. */
  classNames: string;
}

export type SheetValidation =
  | { valid: true; value: { sheetUrl: string; sheetId: string; classNames: string[] } }
  | { valid: false; errors: Partial<Record<keyof SheetForm, string>> };

export function validateSheetForm(form: SheetForm): SheetValidation {
  const errors: Partial<Record<keyof SheetForm, string>> = {};
  const sheetUrl = form.sheetUrl.trim();
  const sheetId = extractSheetId(sheetUrl);
  const classNames = parseClassNames(form.classNames);

  if (!sheetUrl) errors.sheetUrl = "Cole o link da planilha.";
  else if (!sheetId)
    errors.sheetUrl = "Use o link de uma planilha do Google (começa com https://docs.google.com/spreadsheets/d/).";

  if (classNames.length === 0) errors.classNames = "Informe o nome de pelo menos uma aba (turma).";
  else if (classNames.length > MAX_CLASSES) errors.classNames = `Use no máximo ${MAX_CLASSES} turmas.`;
  else if (classNames.some((name) => name.length > 60))
    errors.classNames = "Cada nome de turma deve ter até 60 caracteres.";

  if (!sheetId || Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, value: { sheetUrl, sheetId, classNames } };
}

/**
 * Nome da turma a partir do nome do arquivo. O Google Sheets exporta cada aba como
 * "Nome da planilha - Nome da aba.csv": vale o trecho depois do último " - ".
 */
export function classNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.csv$/i, "");
  const tab = base.split(" - ").pop() ?? base;
  return tab.replace(/\s+/g, " ").trim();
}

export interface CsvFile {
  name: string;
  size: number;
  text: string;
}

/**
 * Converte os CSVs enviados em turmas. Arquivos com problema entram em `errors`
 * (com o motivo) e não impedem os demais.
 */
export function parseCsvFiles(files: CsvFile[]): { classes: ClassData[]; errors: string[] } {
  const classes: ClassData[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const className = classNameFromFile(file.name);
    if (!/\.csv$/i.test(file.name)) errors.push(`“${file.name}”: envie arquivos .csv.`);
    else if (file.size > MAX_CSV_BYTES) errors.push(`“${file.name}”: arquivo maior que 2 MB.`);
    else if (!className) errors.push(`“${file.name}”: não foi possível identificar a turma pelo nome do arquivo.`);
    else if (classes.some((c) => c.name === className))
      errors.push(`“${file.name}”: a turma “${className}” apareceu em mais de um arquivo.`);
    else {
      try {
        classes.push(parseClassCsv(className, file.text));
      } catch {
        errors.push(
          `“${file.name}”: colunas não reconhecidas. O arquivo precisa ter “Data”, “Relação de Alunos” e “Mensagem”.`,
        );
      }
    }
  }
  return { classes, errors };
}

/** Turmas enviadas substituem as de mesmo nome; as demais são mantidas. Ordem alfabética. */
export function mergeClasses(existing: ClassData[], incoming: ClassData[]): ClassData[] {
  const byName = new Map(existing.map((c) => [c.name, c]));
  for (const item of incoming) byName.set(item.name, item);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
}

/** Verifica o formato do JSON da base offline (dado externo). */
export function isAttendanceData(value: unknown): value is AttendanceData {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { generatedAt?: unknown; classes?: unknown };
  return (
    typeof v.generatedAt === "string" &&
    Array.isArray(v.classes) &&
    v.classes.every((c: unknown) => {
      if (typeof c !== "object" || c === null) return false;
      const item = c as { name?: unknown; records?: unknown };
      return (
        typeof item.name === "string" &&
        Array.isArray(item.records) &&
        item.records.every((r: unknown) => {
          if (typeof r !== "object" || r === null) return false;
          const record = r as { date?: unknown; absent?: unknown };
          return (
            typeof record.date === "string" &&
            Array.isArray(record.absent) &&
            record.absent.every((name) => typeof name === "string")
          );
        })
      );
    })
  );
}
