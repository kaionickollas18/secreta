import type {
  DeliveryFormErrors,
  DeliveryFormValues,
  DeliveryInput,
  DocumentFilter,
  DocumentFormErrors,
  DocumentFormValues,
  DocumentInput,
  DocumentKind,
  OfficialDocument,
} from "../types/officialDocument";
import { formatDueDate, isValidISODate, todayISO } from "./date";
import { sanitizeText } from "./validation";

/** Iguais aos limites do banco (`official_documents`). */
export const DOCUMENT_LIMITS = { number: 30, recipient: 120, subject: 160, summary: 2000, receivedBy: 120 } as const;

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  memo: "Memorando",
  oficio: "Ofício",
};

/** "Memorando nº 012/2026". */
export function documentTitle(document: Pick<OfficialDocument, "kind" | "number">): string {
  return `${DOCUMENT_KIND_LABELS[document.kind]} nº ${document.number}`;
}

const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

/** Converte a linha do banco. Devolve `null` se algum campo não for o esperado. */
export function documentFromRow(row: Record<string, unknown>): OfficialDocument | null {
  const { id, kind, number, issued_on: issuedOn, recipient, subject } = row;
  if (typeof id !== "string" || (kind !== "memo" && kind !== "oficio")) return null;
  if (typeof number !== "string" || typeof recipient !== "string" || typeof subject !== "string") return null;
  if (typeof issuedOn !== "string" || !isValidISODate(issuedOn)) return null;
  const deliveredOn = optionalText(row.delivered_on);
  return {
    id,
    kind,
    number,
    issuedOn,
    recipient,
    subject,
    summary: optionalText(row.summary),
    deliveredOn: deliveredOn && isValidISODate(deliveredOn) ? deliveredOn : undefined,
    receivedBy: optionalText(row.received_by),
  };
}

export function isDelivered(document: OfficialDocument): boolean {
  return document.deliveredOn !== undefined;
}

export function filterDocuments(documents: OfficialDocument[], filter: DocumentFilter): OfficialDocument[] {
  if (filter === "all") return documents;
  return documents.filter((d) => isDelivered(d) === (filter === "delivered"));
}

/** Pendentes primeiro (o mais antigo no alto, é o que está esperando há mais tempo); depois os entregues, do mais recente. */
export function sortDocuments(documents: OfficialDocument[]): OfficialDocument[] {
  return [...documents].sort((a, b) => {
    const pending = Number(isDelivered(a)) - Number(isDelivered(b));
    if (pending !== 0) return pending;
    return isDelivered(a)
      ? (b.deliveredOn ?? "").localeCompare(a.deliveredOn ?? "") || b.issuedOn.localeCompare(a.issuedOn)
      : a.issuedOn.localeCompare(b.issuedOn) || a.number.localeCompare(b.number, "pt-BR", { numeric: true });
  });
}

export function countPending(documents: OfficialDocument[]): number {
  return documents.filter((d) => !isDelivered(d)).length;
}

/** `preset`: tipo e número já escolhidos (quando se cria pelo quadro de números). */
export function emptyDocumentForm(
  today: string = todayISO(),
  preset: { kind?: DocumentKind; number?: string } = {},
): DocumentFormValues {
  return {
    kind: preset.kind ?? "memo",
    number: preset.number ?? "",
    issuedOn: today,
    recipient: "",
    subject: "",
    summary: "",
  };
}

export function documentToForm(document: OfficialDocument): DocumentFormValues {
  return {
    kind: document.kind,
    number: document.number,
    issuedOn: document.issuedOn,
    recipient: document.recipient,
    subject: document.subject,
    summary: document.summary ?? "",
  };
}

const oneLine = (value: string) => sanitizeText(value).replace(/\s+/g, " ");

export type DocumentValidation =
  | { valid: true; value: DocumentInput }
  | { valid: false; errors: DocumentFormErrors };

/**
 * `delivered`: o documento em edição já foi entregue; aí o resumo não pode ficar em branco e
 * a data do documento não pode passar da data da entrega (`deliveredOn`).
 */
export function validateDocumentForm(
  values: DocumentFormValues,
  delivered?: { deliveredOn: string },
): DocumentValidation {
  const errors: DocumentFormErrors = {};
  const number = oneLine(values.number);
  const recipient = oneLine(values.recipient);
  const subject = oneLine(values.subject);
  const summary = sanitizeText(values.summary);

  if (number.length === 0) errors.number = "Informe o número do documento.";
  else if (number.length > DOCUMENT_LIMITS.number) errors.number = `Use no máximo ${DOCUMENT_LIMITS.number} caracteres.`;
  if (!isValidISODate(values.issuedOn)) errors.issuedOn = "Informe uma data válida.";
  else if (delivered && values.issuedOn > delivered.deliveredOn)
    errors.issuedOn = `A data não pode ser depois da entrega (${formatDueDate(delivered.deliveredOn)}).`;
  if (recipient.length === 0) errors.recipient = "Informe para quem é o documento.";
  else if (recipient.length > DOCUMENT_LIMITS.recipient)
    errors.recipient = `Use no máximo ${DOCUMENT_LIMITS.recipient} caracteres.`;
  if (subject.length === 0) errors.subject = "Informe o assunto.";
  else if (subject.length > DOCUMENT_LIMITS.subject) errors.subject = `Use no máximo ${DOCUMENT_LIMITS.subject} caracteres.`;
  if (summary.length > DOCUMENT_LIMITS.summary) errors.summary = `Use no máximo ${DOCUMENT_LIMITS.summary} caracteres.`;
  else if (delivered && summary.length === 0) errors.summary = "Documento entregue precisa de resumo.";

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: { kind: values.kind, number, issuedOn: values.issuedOn, recipient, subject, summary: summary || undefined },
  };
}

export function emptyDeliveryForm(document: OfficialDocument, today: string = todayISO()): DeliveryFormValues {
  return { summary: document.summary ?? "", deliveredOn: today, receivedBy: "" };
}

export type DeliveryValidation =
  | { valid: true; value: DeliveryInput }
  | { valid: false; errors: DeliveryFormErrors };

/** Ao marcar a entrega: o resumo é obrigatório e a data fica entre a do documento e hoje. */
export function validateDeliveryForm(
  values: DeliveryFormValues,
  issuedOn: string,
  today: string = todayISO(),
): DeliveryValidation {
  const errors: DeliveryFormErrors = {};
  const summary = sanitizeText(values.summary);
  const receivedBy = oneLine(values.receivedBy);

  if (summary.length === 0) errors.summary = "Escreva um resumo do que se trata o documento.";
  else if (summary.length > DOCUMENT_LIMITS.summary) errors.summary = `Use no máximo ${DOCUMENT_LIMITS.summary} caracteres.`;
  if (!isValidISODate(values.deliveredOn)) errors.deliveredOn = "Informe uma data válida.";
  else if (values.deliveredOn < issuedOn)
    errors.deliveredOn = `A entrega não pode ser antes da data do documento (${formatDueDate(issuedOn)}).`;
  else if (values.deliveredOn > today) errors.deliveredOn = "A entrega não pode ser no futuro.";
  if (receivedBy.length > DOCUMENT_LIMITS.receivedBy)
    errors.receivedBy = `Use no máximo ${DOCUMENT_LIMITS.receivedBy} caracteres.`;

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, value: { summary, deliveredOn: values.deliveredOn, receivedBy: receivedBy || undefined } };
}

// ───────────────────────── Quadro de números ─────────────────────────
// A secretaria controla os documentos por uma grade de números em sequência (1, 2, 3…),
// pintando cada número quando o documento é feito e quando é entregue.

/** Colunas do quadro, como na folha usada na secretaria. */
export const BOARD_COLUMNS = 8;
/** Onde o navegador guarda a visão escolhida (quadro ou lista). */
export const DOCUMENT_VIEW_KEY = "secreta:documentos:visao";

export type DocumentView = "board" | "list";

export function parseDocumentView(raw: string | null): DocumentView {
  return raw === "list" ? "list" : "board";
}

/** Lê "012/2026", "Nº 73" ou "73/26": o número da sequência e, se houver, o ano. */
export function parseDocumentNumber(number: string): { sequence: number; year?: number } | null {
  const match = /^\D*(\d{1,5})(?:\s*\/\s*(\d{4}|\d{2}))?/.exec(number);
  if (!match) return null;
  const sequence = Number(match[1]);
  if (sequence < 1) return null;
  const year = match[2] ? Number(match[2].length === 2 ? `20${match[2]}` : match[2]) : undefined;
  return { sequence, year };
}

/** "073/2026": como o número é preenchido ao criar pelo quadro. */
export function formatDocumentNumber(sequence: number, year: number): string {
  return `${String(sequence).padStart(3, "0")}/${year}`;
}

/** Ano da numeração do documento: o que está no número ou, sem ele, o da data. */
export function documentYear(document: Pick<OfficialDocument, "number" | "issuedOn">): number {
  return parseDocumentNumber(document.number)?.year ?? Number(document.issuedOn.slice(0, 4));
}

/** Anos que têm documentos, mais o atual; do mais recente ao mais antigo. */
export function boardYears(documents: OfficialDocument[], currentYear: number): number[] {
  return [...new Set([currentYear, ...documents.map(documentYear)])].sort((a, b) => b - a);
}

export type BoardCellState = "free" | "pending" | "delivered";

export interface BoardCell {
  sequence: number;
  state: BoardCellState;
  /** O documento que usa este número (ausente quando o número está livre). */
  document?: OfficialDocument;
}

/**
 * Os números de um tipo de documento em um ano, do 1 em diante. O quadro termina em linha
 * cheia e sempre deixa pelo menos uma linha livre depois do último número usado.
 */
export function numberBoard(documents: OfficialDocument[], kind: DocumentKind, year: number): BoardCell[] {
  const used = new Map<number, OfficialDocument>();
  for (const document of documents) {
    if (document.kind !== kind || documentYear(document) !== year) continue;
    const parsed = parseDocumentNumber(document.number);
    // Número repetido: fica o primeiro registrado na lista.
    if (parsed && !used.has(parsed.sequence)) used.set(parsed.sequence, document);
  }
  const highest = Math.max(0, ...used.keys());
  const total = Math.max(BOARD_COLUMNS * 5, (Math.floor(highest / BOARD_COLUMNS) + 2) * BOARD_COLUMNS);
  return Array.from({ length: total }, (_, index) => {
    const sequence = index + 1;
    const document = used.get(sequence);
    return { sequence, document, state: document ? (isDelivered(document) ? "delivered" : "pending") : "free" };
  });
}
