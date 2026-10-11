import { PRIORITY_LABELS, PRIORITY_STYLES } from "../../constants/board";
import type { TaskPriority } from "../../types/task";

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[priority].badge}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
