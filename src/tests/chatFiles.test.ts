import { describe, expect, it } from "vitest";
import {
  CHAT_FILE_MAX_BYTES,
  chatFileType,
  cleanFileName,
  decodeDirectPayload,
  encodeDirectPayload,
  formatFileSize,
  validateChatFile,
} from "../utils/chatFiles";

const meta = { name: "memorando.pdf", type: "application/pdf", size: 2048, iv: "aXY=" };

describe("anexos das conversas diretas", () => {
  it("aceita PDF e imagens; recusa outros tipos, arquivo vazio e acima de 10 MB", () => {
    expect(validateChatFile({ name: "a.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateChatFile({ name: "foto.jpg", type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validateChatFile({ name: "planilha.xlsx", type: "application/vnd.ms-excel", size: 1000 })).toMatch(/PDF ou uma imagem/);
    expect(validateChatFile({ name: "pagina.html", type: "text/html", size: 1000 })).toMatch(/PDF ou uma imagem/);
    expect(validateChatFile({ name: "a.pdf", type: "application/pdf", size: 0 })).toMatch(/vazio/);
    expect(validateChatFile({ name: "a.pdf", type: "application/pdf", size: CHAT_FILE_MAX_BYTES + 1 })).toMatch(/10 MB/);
    expect(validateChatFile({ name: "a.pdf", type: "application/pdf", size: CHAT_FILE_MAX_BYTES })).toBeNull();
  });

  it("sem tipo informado pelo navegador, usa a extensão", () => {
    expect(chatFileType({ name: "Ofício.PDF", type: "" })).toBe("application/pdf");
    expect(chatFileType({ name: "foto.jpeg", type: "" })).toBe("image/jpeg");
    expect(chatFileType({ name: "script.exe", type: "" })).toBeNull();
    // Um tipo informado e não aceito não vira aceito pela extensão.
    expect(chatFileType({ name: "falso.pdf", type: "text/html" })).toBeNull();
  });

  it("limpa o nome do arquivo e mantém a extensão ao encurtar", () => {
    expect(cleanFileName("C:\\fakepath\\ata.pdf")).toBe("ata.pdf");
    expect(cleanFileName("pasta/foto\u0007.png")).toBe("foto.png");
    expect(cleanFileName("   ")).toBe("arquivo");
    const long = cleanFileName(`${"a".repeat(200)}.pdf`);
    expect(long).toHaveLength(120);
    expect(long.endsWith(".pdf")).toBe(true);
  });

  it("nome, tipo e tamanho viajam junto com o texto, e o que vem de fora é conferido", () => {
    const payload = encodeDirectPayload("Segue o memorando", meta);
    expect(decodeDirectPayload(payload)).toEqual({ text: "Segue o memorando", file: meta });
    expect(decodeDirectPayload("texto comum")).toBeNull();
    expect(decodeDirectPayload(JSON.stringify({ text: "x", file: { ...meta, type: "text/html" } }))).toBeNull();
    expect(decodeDirectPayload(JSON.stringify({ text: "x", file: { ...meta, size: -1 } }))).toBeNull();
    expect(decodeDirectPayload(JSON.stringify({ text: 3, file: meta }))).toBeNull();
  });

  it("mostra o tamanho em KB ou MB", () => {
    expect(formatFileSize(850 * 1024)).toBe("850 KB");
    expect(formatFileSize(100)).toBe("1 KB");
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe("2,4 MB");
  });
});
