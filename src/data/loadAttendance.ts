import type { AttendanceData } from "../types/attendance";
import { parseClassCsv } from "../utils/sheetParser";

type FetchLike = (url: string, init?: { signal?: AbortSignal; cache?: RequestCache }) => Promise<Response>;

function sheetUrl(sheetId: string, sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

/**
 * Busca as abas (uma por turma) da planilha da escola. A planilha precisa estar
 * compartilhada para "qualquer pessoa com o link". Falha por inteiro se alguma aba não puder ser lida.
 */
export async function loadAttendance(
  sheetId: string,
  classNames: readonly string[],
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
  signal?: AbortSignal,
): Promise<AttendanceData> {
  const classes = await Promise.all(
    classNames.map(async (name) => {
      const response = await fetchImpl(sheetUrl(sheetId, name), { signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Aba "${name}": HTTP ${response.status}`);
      return parseClassCsv(name, await response.text());
    }),
  );
  return { generatedAt: new Date().toISOString(), classes };
}
