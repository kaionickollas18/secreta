import type { Note, NoteInput } from "../types/note";
import { noteFromRow, noteToRow, type NoteRow } from "../utils/notes";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/** Acesso à tabela `notes` (notas e listas de marcação da escola). */

const GENERIC_ERROR = "Não foi possível salvar. Verifique sua conexão e tente de novo.";
const fail = (error: string = GENERIC_ERROR) => ({ data: null, error });

const COLUMNS =
  "id, title, kind, body, items, task_id, reminder_id, author_id, author_name, created_at, updated_at";

export async function fetchNotes(): Promise<ApiResult<Note[]>> {
  if (!supabase) return fail();
  const { data, error } = await supabase.from("notes").select(COLUMNS);
  if (error) return fail("Não foi possível carregar as notas.");
  return { data: (data as NoteRow[]).flatMap((row) => noteFromRow(row) ?? []), error: null };
}

/** Cria (sem `id`) ou atualiza uma nota. Autor e datas são preenchidos pelo banco. */
export async function saveNote(schoolId: string, input: NoteInput, id?: string): Promise<ApiResult<Note>> {
  if (!supabase) return fail();
  const row = noteToRow(input);
  const query = id
    ? supabase.from("notes").update(row).eq("id", id)
    : supabase.from("notes").insert({ ...row, school_id: schoolId, author_name: "" });
  const { data, error } = await query.select(COLUMNS).single();
  if (error) return fail(error.code === "P0001" ? error.message : GENERIC_ERROR);
  const note = noteFromRow(data as NoteRow);
  return note ? { data: note, error: null } : fail();
}

export async function removeNote(id: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  // Pede a linha de volta: se a RLS barrar a exclusão, nada volta e isso vira erro.
  const { data, error } = await supabase.from("notes").delete().eq("id", id).select("id");
  if (error) return GENERIC_ERROR;
  return data.length === 0 ? "Só quem escreveu a nota ou o secretário pode excluí-la." : null;
}

/** Marca ou desmarca um item (função `set_note_item_done`, que não regrava a lista inteira). */
export async function setItemDone(noteId: string, itemId: string, done: boolean): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.rpc("set_note_item_done", { p_note: noteId, p_item: itemId, p_done: done });
  return error ? "Não foi possível marcar o item. Tente de novo." : null;
}

/** Avisa quando alguém da escola cria, altera ou exclui uma nota. Devolve como parar. */
export function subscribeNotes(onChange: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel("notes-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, onChange)
    .subscribe();
  return () => void client.removeChannel(channel);
}
