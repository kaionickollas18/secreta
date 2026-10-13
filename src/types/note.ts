export const NOTE_KINDS = ["text", "checklist"] as const;
/** `text`: texto livre. `checklist`: lista de itens que podem ser marcados. */
export type NoteKind = (typeof NOTE_KINDS)[number];

export interface NoteItem {
  id: string;
  text: string;
  done: boolean;
}

/** A que a nota está vinculada (no máximo uma tarefa ou um lembrete). */
export type NoteLink = { type: "task"; id: string } | { type: "reminder"; id: string };

export interface Note {
  id: string;
  title: string;
  kind: NoteKind;
  /** Só em notas de texto. */
  body?: string;
  /** Só em listas de marcação (vazio nas notas de texto). */
  items: NoteItem[];
  link?: NoteLink;
  /** `undefined` quando quem escreveu foi excluído do sistema. */
  authorId?: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title: string;
  kind: NoteKind;
  body?: string;
  items: NoteItem[];
  link?: NoteLink;
}

/** Valores crus do formulário (sempre strings). */
export interface NoteFormValues {
  title: string;
  kind: NoteKind;
  body: string;
  /** Um item por linha. */
  itemsText: string;
  /** "" (sem vínculo), "task:<id>" ou "reminder:<id>". */
  link: string;
}

export type NoteFormErrors = Partial<Record<keyof NoteFormValues, string>>;
