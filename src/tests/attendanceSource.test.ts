import { describe, expect, it } from "vitest";
import type { ClassData } from "../types/attendance";
import {
  classNameFromFile,
  extractSheetId,
  isAttendanceData,
  MAX_CSV_BYTES,
  mergeClasses,
  parseClassNames,
  parseCsvFiles,
  validateSheetForm,
} from "../utils/attendanceSource";

const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-abcde";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;
const CSV = '"Data","Relação de Alunos","Mensagem"\n"22/05/2026","Ana Souza","Data: 22/05/2026"';

describe("link da planilha", () => {
  it("extrai o id só de links do Google Sheets", () => {
    expect(extractSheetId(SHEET_URL)).toBe(SHEET_ID);
    expect(extractSheetId(`  ${SHEET_URL}  `)).toBe(SHEET_ID);
    expect(extractSheetId("https://exemplo.com/spreadsheets/d/" + SHEET_ID)).toBeNull();
    expect(extractSheetId("http://docs.google.com/spreadsheets/d/" + SHEET_ID)).toBeNull();
    expect(extractSheetId("planilha da escola")).toBeNull();
  });

  it("lê uma turma por linha, sem vazias nem repetidas", () => {
    expect(parseClassNames(" 5 ano A \n\n5  ano B\r\n5 ano A\n")).toEqual(["5 ano A", "5 ano B"]);
  });

  it("valida o formulário", () => {
    const ok = validateSheetForm({ sheetUrl: SHEET_URL, classNames: "5 ano A\n5 ano B" });
    expect(ok).toEqual({
      valid: true,
      value: { sheetUrl: SHEET_URL, sheetId: SHEET_ID, classNames: ["5 ano A", "5 ano B"] },
    });
    const empty = validateSheetForm({ sheetUrl: "", classNames: " " });
    expect(!empty.valid && empty.errors).toMatchObject({
      sheetUrl: "Cole o link da planilha.",
      classNames: "Informe o nome de pelo menos uma aba (turma).",
    });
    expect(validateSheetForm({ sheetUrl: "https://exemplo.com", classNames: "A" }).valid).toBe(false);
  });
});

describe("arquivos CSV da base offline", () => {
  it("tira o nome da turma do nome do arquivo", () => {
    expect(classNameFromFile("5 ano A.csv")).toBe("5 ano A");
    expect(classNameFromFile("Frequência 2026 - 6 ano B.CSV")).toBe("6 ano B");
  });

  it("converte os arquivos válidos e explica os problemas dos demais", () => {
    const { classes, errors } = parseCsvFiles([
      { name: "5 ano A.csv", size: 100, text: CSV },
      { name: "Planilha - 5 ano A.csv", size: 100, text: CSV },
      { name: "notas.xlsx", size: 100, text: "" },
      { name: "grande.csv", size: MAX_CSV_BYTES + 1, text: CSV },
      { name: "errado.csv", size: 100, text: "a,b\n1,2" },
    ]);
    expect(classes).toEqual([{ name: "5 ano A", records: [{ date: "2026-05-22", absent: ["Ana Souza"] }] }]);
    expect(errors).toHaveLength(4);
    expect(errors[0]).toContain("mais de um arquivo");
    expect(errors[1]).toContain(".csv");
    expect(errors[2]).toContain("2 MB");
    expect(errors[3]).toContain("colunas não reconhecidas");
  });

  it("junta turmas: as enviadas substituem as de mesmo nome", () => {
    const old: ClassData[] = [
      { name: "6 ano A", records: [] },
      { name: "10 ano A", records: [] },
      { name: "5 ano A", records: [] },
    ];
    const fresh: ClassData[] = [{ name: "5 ano A", records: [{ date: "2026-05-22", absent: [] }] }];
    const merged = mergeClasses(old, fresh);
    expect(merged.map((c) => c.name)).toEqual(["5 ano A", "6 ano A", "10 ano A"]);
    expect(merged[0]?.records).toHaveLength(1);
  });

  it("reconhece o formato do JSON salvo e rejeita o resto", () => {
    const good = { generatedAt: "2026-10-10T00:00:00Z", classes: [{ name: "A", records: [{ date: "2026-05-22", absent: ["Ana"] }] }] };
    expect(isAttendanceData(good)).toBe(true);
    expect(isAttendanceData({ ...good, classes: [{ name: "A", records: [{ date: 1, absent: [] }] }] })).toBe(false);
    expect(isAttendanceData({ classes: [] })).toBe(false);
    expect(isAttendanceData(null)).toBe(false);
  });
});
