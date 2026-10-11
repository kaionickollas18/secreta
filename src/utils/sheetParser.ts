import type { ClassData, DayRecord } from "../types/attendance";

/** Lê CSV com campos entre aspas, inclusive com quebras de linha dentro do campo. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toISO(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseDate(message: string, dateCell: string): string | undefined {
  const fromMessage = /Data:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(message);
  if (fromMessage) return toISO(fromMessage[1] ?? "", fromMessage[2] ?? "", fromMessage[3] ?? "");
  const fromCell = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(dateCell);
  return fromCell ? toISO(fromCell[1] ?? "", fromCell[2] ?? "", fromCell[3] ?? "") : undefined;
}

function splitNames(...cells: string[]): string[] {
  return cells
    .flatMap((cell) => cell.split(","))
    .map((name) => name.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Converte o CSV de uma aba (uma linha por dia de chamada) em dados da turma.
 * Colunas usadas: "Data", "Relação de Alunos", "Relação de Alunos 2" (opcional) e "Mensagem".
 */
export function parseClassCsv(name: string, csv: string): ClassData {
  const rows = parseCsv(csv);
  const header = (rows[0] ?? []).map((h) => h.trim());
  const iDate = header.indexOf("Data");
  const iA = header.indexOf("Relação de Alunos");
  const iB = header.indexOf("Relação de Alunos 2");
  const iMsg = header.indexOf("Mensagem");
  if (iDate === -1 || iA === -1 || iMsg === -1) {
    throw new Error(`Aba "${name}": cabeçalho inesperado.`);
  }

  const byDate = new Map<string, string[]>();
  for (const row of rows.slice(1)) {
    // A planilha tem linhas de preenchimento com a data em branco: ignorar.
    if ((row[iDate] ?? "").trim() === "") continue;
    const date = parseDate(row[iMsg] ?? "", row[iDate] ?? "");
    if (!date) continue;
    const absent = splitNames(row[iA] ?? "", iB === -1 ? "" : (row[iB] ?? ""));
    // Se a mesma data aparecer duas vezes, une os ausentes.
    byDate.set(date, [...new Set([...(byDate.get(date) ?? []), ...absent])]);
  }

  const records: DayRecord[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, absent]) => ({ date, absent }));
  return { name, records };
}
