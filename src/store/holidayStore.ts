import { create } from "zustand";
import type { Holiday, HolidayInput } from "../types/calendar";
import { fetchHolidays, removeHoliday, saveHoliday } from "./holidayApi";

interface HolidayState {
  /** Só os feriados cadastrados pela escola; os nacionais são calculados. */
  holidays: Holiday[];
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
  /** Cria (sem `id`) ou edita. Devolve a mensagem de erro, ou `null` se deu certo. */
  save: (schoolId: string, input: HolidayInput, id?: string) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
}

export const useHolidayStore = create<HolidayState>((set) => ({
  holidays: [],
  status: "idle",

  load: async () => {
    set((s) => ({ status: s.status === "ready" ? "ready" : "loading" }));
    const result = await fetchHolidays();
    if (result.error !== null) return set({ status: "error" });
    set({ status: "ready", holidays: result.data });
  },

  save: async (schoolId, input, id) => {
    const result = await saveHoliday(schoolId, input, id);
    if (result.error !== null) return result.error;
    const saved = result.data;
    set((s) => ({ holidays: [...s.holidays.filter((h) => h.id !== saved.id), saved] }));
    return null;
  },

  remove: async (id) => {
    const error = await removeHoliday(id);
    if (!error) set((s) => ({ holidays: s.holidays.filter((h) => h.id !== id) }));
    return error;
  },
}));
