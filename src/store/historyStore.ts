import { create } from "zustand";
import type { HistoryEntry } from "../types/task";
import { DEFAULT_HISTORY_PERIOD, periodStart, type HistoryPeriod } from "../utils/history";
import { fetchHistory } from "./taskApi";

interface HistoryState {
  entries: HistoryEntry[];
  period: HistoryPeriod;
  status: "idle" | "loading" | "ready" | "error";
  /** Carrega as tarefas concluídas do período (padrão: o período atual). */
  load: (period?: HistoryPeriod) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  period: DEFAULT_HISTORY_PERIOD,
  status: "idle",

  load: async (period = get().period) => {
    set({ period, status: "loading" });
    const result = await fetchHistory(periodStart(period));
    // Ignora a resposta se o usuário já trocou de período.
    if (get().period !== period) return;
    if (result.error !== null) return set({ status: "error", entries: [] });
    set({ status: "ready", entries: result.data });
  },
}));
