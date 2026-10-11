import { create } from "zustand";
import type { Reminder, ReminderInput } from "../types/reminder";
import { completionKey } from "../utils/reminders";
import { fetchReminders, removeReminder, saveReminder, setCompletion } from "./reminderApi";

interface ReminderState {
  reminders: Reminder[];
  /** Ciclos já cumpridos, no formato de `completionKey`. */
  doneKeys: ReadonlySet<string>;
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
  /** Cria (sem `id`) ou edita. Devolve a mensagem de erro, ou `null` se deu certo. */
  save: (schoolId: string, input: ReminderInput, id?: string) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
  setDone: (schoolId: string, reminderId: string, periodKey: string, done: boolean) => Promise<string | null>;
}

export const useReminderStore = create<ReminderState>((set, get) => ({
  reminders: [],
  doneKeys: new Set(),
  status: "idle",

  load: async () => {
    set((s) => ({ status: s.status === "ready" ? "ready" : "loading" }));
    const result = await fetchReminders();
    if (result.error !== null) return set({ status: "error" });
    set({
      status: "ready",
      reminders: result.data.reminders,
      doneKeys: new Set(result.data.doneKeys),
    });
  },

  save: async (schoolId, input, id) => {
    const result = await saveReminder(schoolId, input, id);
    if (result.error !== null) return result.error;
    const saved = result.data;
    set((s) => ({ reminders: [...s.reminders.filter((r) => r.id !== saved.id), saved] }));
    return null;
  },

  remove: async (id) => {
    const error = await removeReminder(id);
    if (!error) set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
    return error;
  },

  setDone: async (schoolId, reminderId, periodKey, done) => {
    const error = await setCompletion(schoolId, reminderId, periodKey, done);
    if (error) return error;
    const next = new Set(get().doneKeys);
    const key = completionKey(reminderId, periodKey);
    if (done) next.add(key);
    else next.delete(key);
    set({ doneKeys: next });
    return null;
  },
}));
