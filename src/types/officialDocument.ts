export const DOCUMENT_KINDS = ["memo", "oficio"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Memorando ou ofício acompanhado pela secretaria (tabela `official_documents`). */
export interface OfficialDocument {
  id: string;
  kind: DocumentKind;
  /** Número como está no documento (ex.: "012/2026"). */
  number: string;
  /** Data do documento (YYYY-MM-DD). */
  issuedOn: string;
  recipient: string;
  subject: string;
  /** Do que se trata. Obrigatório ao marcar a entrega. */
  summary?: string;
  /** Data da entrega (YYYY-MM-DD). Ausente enquanto não foi entregue. */
  deliveredOn?: string;
  /** Quem recebeu, se foi anotado. */
  receivedBy?: string;
}

export interface DocumentInput {
  kind: DocumentKind;
  number: string;
  issuedOn: string;
  recipient: string;
  subject: string;
  summary?: string;
}

/** Valores crus do formulário (sempre strings). */
export interface DocumentFormValues {
  kind: DocumentKind;
  number: string;
  issuedOn: string;
  recipient: string;
  subject: string;
  summary: string;
}

export type DocumentFormErrors = Partial<Record<keyof DocumentFormValues, string>>;

/** O que se informa ao marcar a entrega. */
export interface DeliveryInput {
  summary: string;
  deliveredOn: string;
  receivedBy?: string;
}

export interface DeliveryFormValues {
  summary: string;
  deliveredOn: string;
  receivedBy: string;
}

export type DeliveryFormErrors = Partial<Record<keyof DeliveryFormValues, string>>;

export type DocumentFilter = "all" | "pending" | "delivered";
