import { create } from "zustand";
import type { TaskFilters, TaskPriority } from "../types/task";
import { DEFAULT_FILTERS } from "../utils/tasks";

interface FilterState extends TaskFilters {
  setQuery: (query: string) => void;
  setPriority: (priority: TaskPriority | "all") => void;
  setAssignee: (assignee: TaskFilters["assignee"]) => void;
  setOverdueOnly: (value: boolean) => void;
  clear: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  ...DEFAULT_FILTERS,
  setQuery: (query) => set({ query }),
  setPriority: (priority) => set({ priority }),
  setAssignee: (assignee) => set({ assignee }),
  setOverdueOnly: (overdueOnly) => set({ overdueOnly }),
  clear: () => set({ ...DEFAULT_FILTERS }),
}));
