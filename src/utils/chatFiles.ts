/**
 * Anexos das conversas diretas (PDF e imagens): limites, validação e o formato em que nome,
 * tipo e tamanho viajam dentro da mensagem embaralhada.
 */

/** Maior arquivo aceito: 10 MB. */
export const CHAT_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** Tipos aceitos e a extensão de cada um (alguns navegadores não informam o tipo). */
const TYPES_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};
const ALLOWED_TYPES = new Set(Object.values(TYPES_BY_EXTENSION));

/** Valor do `accept` do campo de arquivo. */
export const CHAT_FILE_ACCEPT = [...ALLOWED_TYPES, ...Object.keys(TYPES_BY_EXTENSION).map((ext) => `.${ext}`)].join(",");

/** O que a mensagem leva sobre o arquivo (tudo dentro do texto embaralhado). */
export interface ChatFileMeta {
  name: string;
  type: string;
  size: number;
  /** Vetor da criptografia do arquivo (o arquivo tem o seu, separado do texto). */
  iv: string;
}

const NAME_MAX = 120;

/** Tipo do arquivo: o informado pelo navegador ou, sem ele, o da extensão. `null` = não aceito. */
export function chatFileType(file: { name: string; type: string }): string | null {
  if (ALLOWED_TYPES.has(file.type)) return file.type;
  if (file.type !== "") return null;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPES_BY_EXTENSION[extension] ?? null;
}

/** Mensagem de erro, ou `null` se o arquivo pode ser enviado. */
export function validateChatFile(file: { name: string; type: string; size: number }): string | null {
  if (!chatFileType(file)) return "Envie um PDF ou uma imagem (JPG, PNG, WEBP ou GIF).";
  if (file.size === 0) return "Este arquivo está vazio.";
  if (file.size > CHAT_FILE_MAX_BYTES) return "O arquivo passa de 10 MB. Envie um arquivo menor.";
  return null;
}

/** Nome sem pastas nem caracteres de controle, com no máximo 120 caracteres. */
export function cleanFileName(name: string): string {
  // eslint-disable-next-line no-control-regex -- remove caracteres de controle de propósito
  const base = (name.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (base === "") return "arquivo";
  if (base.length <= NAME_MAX) return base;
  const dot = base.lastIndexOf(".");
  const extension = dot > 0 && base.length - dot <= 6 ? base.slice(dot) : "";
  return base.slice(0, NAME_MAX - extension.length) + extension;
}

export function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

/** "850 KB", "2,4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Texto que é embaralhado numa mensagem com anexo. */
export function encodeDirectPayload(text: string, file: ChatFileMeta): string {
  return JSON.stringify({ text, file });
}

function isFileMeta(value: unknown): value is ChatFileMeta {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Record<string, unknown>;
  return (
    typeof meta.name === "string" &&
    meta.name !== "" &&
    typeof meta.type === "string" &&
    ALLOWED_TYPES.has(meta.type) &&
    typeof meta.size === "number" &&
    Number.isFinite(meta.size) &&
    meta.size > 0 &&
    typeof meta.iv === "string" &&
    meta.iv !== ""
  );
}

/** Lê o texto aberto de uma mensagem com anexo. `null` se o formato não for o esperado. */
export function decodeDirectPayload(raw: string): { text: string; file: ChatFileMeta } | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { text, file } = value as Record<string, unknown>;
  if (typeof text !== "string" || !isFileMeta(file)) return null;
  return { text, file: { name: cleanFileName(file.name), type: file.type, size: file.size, iv: file.iv } };
}
