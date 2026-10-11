import { describe, expect, it, vi } from "vitest";
import { loadAttendance } from "../data/loadAttendance";
import { parseClassCsv, parseCsv } from "../utils/sheetParser";

const HEADER = '"Carimbo de data/hora","Data","Relação de Alunos","Relação de Alunos 2","Mensagem","Enviar","TOTAL"';
const csv = [
  HEADER,
  '"22/05/2026 08:26","22/05/2026","Ana Souza, José  Lima","Moisés Silva","Frequência Escolar - 5 ano A\n\nData: 22/05/2026\n\nAlunos ausentes:\nAna","📲","3"',
  '"26/05/2026 09:00","26/05/2026","","","Frequência\nData: 26/05/2026","📲","0"',
  '"","","","","Frequência\nData: 30/12/1899","📲","0"',
  '"25/05/2026 08:00","25/05/2026","Ana Souza","","Frequência\nData: 25/05/2026","📲","1"',
].join("\n");

describe("parseCsv", () => {
  it("respeita aspas, vírgulas e quebras de linha dentro do campo", () => {
    expect(parseCsv('"a,b","c\nd","e ""f"""\n"x","y","z"')).toEqual([
      ["a,b", "c\nd", 'e "f"'],
      ["x", "y", "z"],
    ]);
  });
});

describe("parseClassCsv", () => {
  it("separa os nomes, junta as duas colunas, ordena por data e ignora linhas sem data", () => {
    const result = parseClassCsv("5 ano A", csv);
    expect(result.name).toBe("5 ano A");
    expect(result.records).toEqual([
      { date: "2026-05-22", absent: ["Ana Souza", "José Lima", "Moisés Silva"] },
      { date: "2026-05-25", absent: ["Ana Souza"] },
      { date: "2026-05-26", absent: [] },
    ]);
  });

  it("falha com cabeçalho inesperado", () => {
    expect(() => parseClassCsv("X", "a,b\n1,2")).toThrow(/cabeçalho/);
  });
});

describe("loadAttendance", () => {
  const classNames = ["5 ano A", "6 ano B"];

  it("busca as abas da planilha da escola e monta os dados", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => new Response(csv));
    const data = await loadAttendance("SHEET_ID", classNames, fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=6%20ano%20B",
    );
    expect(data.classes.map((c) => c.name)).toEqual(classNames);
    expect(data.classes[0]?.records).toHaveLength(3);
  });

  it("rejeita quando uma aba não responde", async () => {
    const fetchMock = vi.fn(async () => new Response("erro", { status: 500 }));
    await expect(loadAttendance("SHEET_ID", classNames, fetchMock)).rejects.toThrow(/HTTP 500/);
  });
});
