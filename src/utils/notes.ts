import type {
  Note,
  NoteFormErrors,
  NoteFormValues,
  NoteInput,
  NoteItem,
  NoteKind,
  NoteLink,
} from "../types/note";
import { sanitizeText } from "./validation";

/** Iguais aos limites do banco (`notes`). */
export const NOTE_LIMITS = { title: 120, body: 4000, items: 60, item: 200 } as const;

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  text: "Texto",
  checklist: "Lista de marcação",
};

function newItemId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function linkToValue(link: NoteLink | undefined): string {
  return link ? `${link.type}:${link.id}` : "";
}

export function linkFromValue(value: string): NoteLink | undefined {
  const separator = value.indexOf(":");
  if (separator < 0) return undefined;
  const type = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!id || (type !== "task" && type !== "reminder")) return undefined;
  return { type, id };
}

/** Vínculo pedido no endereço da página: `?tarefa=<id>` ou `?lembrete=<id>`. */
export function linkFromSearch(search: string): NoteLink | undefined {
  const params = new URLSearchParams(search);
  const task = params.get("tarefa");
  if (task) return { type: "task", id: task };
  const reminder = params.get("lembrete");
  return reminder ? { type: "reminder", id: reminder } : undefined;
}

/** Endereço que abre a página de notas já criando uma nota vinculada. */
export function newNoteHref(link: NoteLink): string {
  return `notas.html?${link.type === "task" ? "tarefa" : "lembrete"}=${encodeURIComponent(link.id)}`;
}

function isItem(value: unknown): value is NoteItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.text === "string" && typeof item.done === "boolean";
}

export interface NoteRow {
  id: unknown;
  title: unknown;
  kind: unknown;
  body: unknown;
  items: unknown;
  task_id: unknown;
  reminder_id: unknown;
  author_id: unknown;
  author_name: unknown;
  created_at: unknown;
  updated_at: unknown;
}

/** Converte a linha do banco. Devolve `null` se algum campo não for o esperado. */
export function noteFromRow(row: NoteRow): Note | null {
  const { id, title, kind, author_name: authorName, created_at: createdAt, updated_at: updatedAt } = row;
  if (typeof id !== "string" || typeof title !== "string" || typeof authorName !== "string") return null;
  if (typeof createdAt !== "string" || typeof updatedAt !== "string") return null;
  if (kind !== "text" && kind !== "checklist") return null;
  if (!Array.isArray(row.items) || !row.items.every(isItem)) return null;
  const link: NoteLink | undefined =
    typeof row.task_id === "string"
      ? { type: "task", id: row.task_id }
      : typeof row.reminder_id === "string"
        ? { type: "reminder", id: row.reminder_id }
        : undefined;
  return {
    id,
    title,
    kind,
    body: typeof row.body === "string" && row.body !== "" ? row.body : undefined,
    items: row.items.map(({ id: itemId, text, done }) => ({ id: itemId, text, done })),
    link,
    authorId: typeof row.author_id === "string" ? row.author_id : undefined,
    authorName,
    createdAt,
    updatedAt,
  };
}

/** Campos no formato do banco. */
export function noteToRow(input: NoteInput) {
  return {
    title: input.title,
    kind: input.kind,
    body: input.kind === "text" ? (input.body ?? null) : null,
    items: input.kind === "checklist" ? input.items : [],
    task_id: input.link?.type === "task" ? input.link.id : null,
    reminder_id: input.link?.type === "reminder" ? input.link.id : null,
  };
}

/** Quantos itens já foram marcados. Notas de texto têm total 0. */
export function noteProgress(note: Pick<Note, "items">): { done: number; total: number } {
  return { done: note.items.filter((i) => i.done).length, total: note.items.length };
}

/** Itens que ainda faltam, somando várias notas. */
export function pendingItems(notes: Note[]): number {
  return notes.reduce((sum, note) => sum + note.items.filter((i) => !i.done).length, 0);
}

/** As mexidas mais recentemente primeiro. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function notesLinkedTo(notes: Note[], link: NoteLink): Note[] {
  return sortNotes(notes.filter((n) => n.link?.type === link.type && n.link.id === link.id));
}

export function withItemDone(note: Note, itemId: string, done: boolean): Note {
  return { ...note, items: note.items.map((i) => (i.id === itemId ? { ...i, done } : i)) };
}

export function emptyNoteForm(link?: NoteLink): NoteFormValues {
  return { title: "", kind: "checklist", body: "", itemsText: "", link: linkToValue(link) };
}

export function noteToForm(note: Note): NoteFormValues {
  return {
    title: note.title,
    kind: note.kind,
    body: note.body ?? "",
    itemsText: note.items.map((i) => i.text).join("\n"),
    link: linkToValue(note.link),
  };
}

export type NoteValidation = { valid: true; value: NoteInput } | { valid: false; errors: NoteFormErrors };

/**
 * `previous`: itens da nota em edição. Uma linha com o mesmo texto de um item antigo mantém
 * a marcação dele; linhas novas entram desmarcadas.
 */
export function validateNoteForm(
  values: NoteFormValues,
  previous: NoteItem[] = [],
  makeId: () => string = newItemId,
): NoteValidation {
  const errors: NoteFormErrors = {};
  const title = sanitizeText(values.title);
  const body = sanitizeText(values.body);
  let items: NoteItem[] = [];

  if (title.length === 0) errors.title = "Dê um título à nota.";
  else if (title.length > NOTE_LIMITS.title)
    errors.title = `Use no máximo ${NOTE_LIMITS.title} caracteres no título.`;

  if (values.kind === "text") {
    if (body.length > NOTE_LIMITS.body) errors.body = `Use no máximo ${NOTE_LIMITS.body} caracteres no texto.`;
  } else {
    const lines = values.itemsText.split("\n").map(sanitizeText).filter(Boolean);
    if (lines.length === 0) errors.itemsText = "Escreva pelo menos um item, um por linha.";
    else if (lines.length > NOTE_LIMITS.items)
      errors.itemsText = `Use no máximo ${NOTE_LIMITS.items} itens por lista.`;
    else if (lines.some((line) => line.length > NOTE_LIMITS.item))
      errors.itemsText = `Cada item pode ter no máximo ${NOTE_LIMITS.item} caracteres.`;
    else {
      const available = [...previous];
      items = lines.map((text) => {
        const index = available.findIndex((i) => i.text === text);
        const kept = index >= 0 ? available.splice(index, 1)[0] : undefined;
        return kept ?? { id: makeId(), text, done: false };
      });
    }
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: {
      title,
      kind: values.kind,
      body: values.kind === "text" && body ? body : undefined,
      items,
      link: linkFromValue(values.link),
    },
  };
}
