import { PRIORITY_LABELS, PRIORITY_STYLES } from "../../constants/board";
import { TASK_PRIORITIES, type TaskPriority } from "../../types/task";
import { isTaskPriority } from "../../utils/guards";

interface PrioritySelectProps {
  value: TaskPriority;
  label: string;
  onChange: (priority: TaskPriority) => void;
}

/** Select com aparência de selo, para trocar a prioridade direto no cartão. */
export function PrioritySelect({ value, label, onChange }: PrioritySelectProps) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => {
        const next = event.target.value;
        if (isTaskPriority(next)) onChange(next);
      }}
      className={`cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-6 text-xs font-semibold ${PRIORITY_STYLES[value].badge}`}
    >
      {TASK_PRIORITIES.map((priority) => (
        <option key={priority} value={priority}>
          {PRIORITY_LABELS[priority]}
        </option>
      ))}
    </select>
  );
}
