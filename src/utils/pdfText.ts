/** Um pedaço de texto do PDF, na posição em que foi desenhado (pontos; y cresce para cima). */
export interface TextItem {
  page: number;
  x: number;
  y: number;
  str: string;
}

export interface TextCell {
  x: number;
  text: string;
}

/** Itens com o mesmo y arredondado, da esquerda para a direita. */
export interface TextLine {
  page: number;
  y: number;
  cells: TextCell[];
}

/** Junta os itens em linhas, na ordem de leitura: página a página, de cima para baixo. */
export function groupLines(items: TextItem[]): TextLine[] {
  const lines = new Map<string, TextLine>();
  for (const item of items) {
    const text = item.str.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const y = Math.round(item.y);
    const key = `${item.page}:${y}`;
    let line = lines.get(key);
    if (!line) {
      line = { page: item.page, y, cells: [] };
      lines.set(key, line);
    }
    line.cells.push({ x: Math.round(item.x), text });
  }
  const sorted = [...lines.values()].sort((a, b) => a.page - b.page || b.y - a.y);
  for (const line of sorted) line.cells.sort((a, b) => a.x - b.x);
  return sorted;
}

/** Texto da linha inteira, células separadas por espaço. */
export const lineText = (line: TextLine): string => line.cells.map((cell) => cell.text).join(" ");

/**
 * Sem espaços nem acentos, em maiúsculas: o PDF da rede quebra palavras ("ENSINO FUNDAM ENTAL",
 * "M ATUTINO"), então as comparações são feitas assim.
 */
export const compact = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "")
    .toUpperCase();

/** Turma de Atendimento Educacional Especializado: fica fora do cadastro e das notas. */
export const isAeeCourse = (course: string): boolean => {
  const key = compact(course);
  return key.includes("ATENDIMENTOEDUCACIONALESPECIALIZADO") || key.includes("A.E.E");
};

/** "5º ANO" + "A" → "5 ano A" (o nome usado no cadastro e no dashboard). */
export function classNameOf(series: string, group: string): string | null {
  const grade = /(\d{1,2})/.exec(series)?.[1];
  const letter = compact(group).replace(/[^A-Z]/g, "");
  if (!grade || !letter) return null;
  return `${grade} ano ${letter}`;
}

/** "ENSINO FUNDAMENTAL 1º/5º ANOS" → ef1; "… 6º/9º ANOS" → ef2. */
export function segmentOfCourse(course: string): "ef1" | "ef2" | null {
  const key = compact(course);
  if (!key.includes("ENSINOFUNDAMENTAL")) return null;
  const years = key.replace(/[º°]/g, "");
  if (years.includes("1/5")) return "ef1";
  if (years.includes("6/9")) return "ef2";
  return null;
}

/** dd/mm/aa ou dd/mm/aaaa → aaaa-mm-dd (anos de dois dígitos são 20aa). Inválida → "". */
export function isoDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return "";
  const [, day = "", month = "", rawYear = ""] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(day)) return "";
  return `${year}-${month}-${day}`;
}
