import { useMemo } from "react";
import { useFilterStore } from "../store/filterStore";
import { useTaskStore } from "../store/taskStore";
import { filterTasks, groupByStatus, hasActiveFilters, onBoard } from "../utils/tasks";
import { useBoardAccess } from "./useBoardAccess";

export function useFilteredTasks() {
  const allTasks = useTaskStore((s) => s.tasks);
  const query = useFilterStore((s) => s.query);
  const priority = useFilterStore((s) => s.priority);
  const assignee = useFilterStore((s) => s.assignee);
  const overdueOnly = useFilterStore((s) => s.overdueOnly);
  const { nameOf } = useBoardAccess();

  return useMemo(() => {
    // Concluídas há mais de alguns dias ficam só no histórico.
    const tasks = allTasks.filter((t) => onBoard(t));
    const filters = { query, priority, assignee, overdueOnly };
    const filtered = filterTasks(tasks, filters, undefined, nameOf);
    return {
      total: tasks.length,
      visible: filtered.length,
      grouped: groupByStatus(filtered),
      totals: Object.fromEntries(
        Object.entries(groupByStatus(tasks)).map(([status, list]) => [status, list.length]),
      ) as Record<string, number>,
      filtersActive: hasActiveFilters(filters),
      doneCount: tasks.filter((t) => t.status === "done").length,
      /** Pedidos de conclusão aguardando o secretário. */
      pendingCount: tasks.filter((t) => t.completionRequested).length,
    };
  }, [allTasks, query, priority, assignee, overdueOnly, nameOf]);
}
