import { create } from "zustand";
import type { Note, NoteInput } from "../types/note";
import { withItemDone } from "../utils/notes";
import { fetchNotes, removeNote, saveNote, setItemDone, subscribeNotes } from "./noteApi";

interface NoteState {
  notes: Note[];
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
  /** Recarrega quando alguém da escola mexe em uma nota. Devolve como parar. */
  watch: () => () => void;
  /** Cria (sem `id`) ou edita. Devolve a mensagem de erro, ou `null` se deu certo. */
  save: (schoolId: string, input: NoteInput, id?: string) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
  /** Marca na hora e desfaz se o banco recusar. */
  toggleItem: (noteId: string, itemId: string, done: boolean) => Promise<string | null>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  status: "idle",

  load: async () => {
    set((s) => ({ status: s.status === "ready" ? "ready" : "loading" }));
    const result = await fetchNotes();
    if (result.error !== null) return set({ status: "error" });
    set({ status: "ready", notes: result.data });
  },

  watch: () => subscribeNotes(() => void get().load()),

  save: async (schoolId, input, id) => {
    const result = await saveNote(schoolId, input, id);
    if (result.error !== null) return result.error;
    const saved = result.data;
    set((s) => ({ notes: [...s.notes.filter((n) => n.id !== saved.id), saved] }));
    return null;
  },

  remove: async (id) => {
    const error = await removeNote(id);
    if (!error) set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    return error;
  },

  toggleItem: async (noteId, itemId, done) => {
    const apply = (value: boolean) =>
      set((s) => ({ notes: s.notes.map((n) => (n.id === noteId ? withItemDone(n, itemId, value) : n)) }));
    apply(done);
    const error = await setItemDone(noteId, itemId, done);
    if (error) apply(!done);
    return error;
  },
}));
