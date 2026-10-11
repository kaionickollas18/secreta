import { PRIORITY_LABELS } from "../../constants/board";
import { useBoardAccess } from "../../hooks/useBoardAccess";
import { useFilterStore } from "../../store/filterStore";
import { TASK_PRIORITIES } from "../../types/task";
import { isTaskPriority } from "../../utils/guards";
import { Button } from "../ui/Button";
import { SearchIcon } from "../ui/Icons";

interface FilterBarProps {
  visible: number;
  total: number;
  filtersActive: boolean;
}

export function FilterBar({ visible, total, filtersActive }: FilterBarProps) {
  const {
    query,
    priority,
    assignee,
    overdueOnly,
    setQuery,
    setPriority,
    setAssignee,
    setOverdueOnly,
    clear,
  } = useFilterStore();
  const { people } = useBoardAccess();

  return (
    <div role="search" className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon />
        </span>
        <input
          type="search"
          aria-label="Buscar tarefas"
          placeholder="Buscar por título, descrição ou responsável"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="glass min-h-[40px] w-full rounded-full py-2 pl-10 pr-3 text-sm placeholder:text-muted"
        />
      </div>

      <select
        aria-label="Filtrar por prioridade"
        value={priority}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "all" || isTaskPriority(next)) setPriority(next);
        }}
        className="glass min-h-[40px] rounded-full px-3 text-sm"
      >
        <option value="all">Todas as prioridades</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrar por responsável"
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
        className="glass min-h-[40px] rounded-full px-3 text-sm"
      >
        <option value="all">Todos os responsáveis</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            @{person.lastName}
          </option>
        ))}
        <option value="none">Sem responsável</option>
      </select>

      <label className="inline-flex min-h-[40px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={overdueOnly}
          onChange={(e) => setOverdueOnly(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Só atrasadas
      </label>

      {filtersActive && (
        <>
          <span className="text-sm text-muted" aria-live="polite">
            {visible} de {total} tarefas
          </span>
          <Button variant="ghost" onClick={clear}>
            Limpar filtros
          </Button>
        </>
      )}
    </div>
  );
}
