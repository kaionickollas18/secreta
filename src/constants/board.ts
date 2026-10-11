import type { TaskPriority, TaskStatus } from "../types/task";

export const COLUMN_PREFIX = "column:";

/** Máximo de responsáveis por tarefa (igual ao limite do banco). */
export const MAX_ASSIGNEES = 3;

/** Aviso ao auxiliar quando o pedido de conclusão é registrado. */
export const REQUESTED_MESSAGE = "Pedido de conclusão enviado. Aguarde a aprovação do secretário.";

export const LIMITS = {
  title: 120,
  description: 1000,
} as const;

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "A Fazer",
  in_progress: "Em Progresso",
  review: "Em Revisão",
  done: "Concluído",
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-blue-400",
  in_progress: "bg-accent-light",
  review: "bg-magenta",
  done: "bg-prio-low",
};

export const EMPTY_COLUMN_HINTS: Record<TaskStatus, string> = {
  todo: "Arraste para cá o que você vai fazer em seguida.",
  in_progress: "Mantenha poucas tarefas aqui para terminar mais rápido.",
  review: "Tarefas aguardando conferência ficam nesta coluna.",
  done: "Tudo o que for concluído aparece aqui.",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

/** `band`: faixa na base do cartão, na cor da prioridade. `badge`: o selo com o nome. */
export const PRIORITY_STYLES: Record<TaskPriority, { band: string; badge: string }> = {
  low: { band: "bg-prio-low", badge: "bg-prio-low-tint text-prio-low" },
  medium: { band: "bg-prio-medium", badge: "bg-prio-medium-tint text-prio-medium" },
  high: { band: "bg-prio-high", badge: "bg-prio-high-tint text-prio-high" },
  urgent: { band: "bg-prio-urgent", badge: "bg-prio-urgent-tint text-prio-urgent" },
};
