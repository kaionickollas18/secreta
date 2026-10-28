import { LIMITS, MAX_ASSIGNEES } from "../constants/board";
import type { FieldErrors, TaskFormValues, TaskInput } from "../types/task";
import { isValidISODate } from "./date";
import { isTaskPriority, isTaskStatus } from "./guards";

/** Remove caracteres de controle (mantém quebras de linha e tabs) e apara as pontas. */
export function sanitizeText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export type ValidationResult =
  | { valid: true; value: TaskInput }
  | { valid: false; errors: FieldErrors };

/** `validAssignees`: ids das pessoas que podem ser responsáveis (secretário e assistentes da escola). */
export function validateTaskForm(
  values: TaskFormValues,
  validAssignees: readonly string[] = [],
): ValidationResult {
  const errors: FieldErrors = {};
  const title = sanitizeText(values.title);
  const description = sanitizeText(values.description);
  const dueDate = values.dueDate.trim();

  if (title.length === 0) errors.title = "Informe um título para a tarefa.";
  else if (title.length > LIMITS.title)
    errors.title = `Use no máximo ${LIMITS.title} caracteres no título.`;

  if (description.length > LIMITS.description)
    errors.description = `Use no máximo ${LIMITS.description} caracteres na descrição.`;

  if (dueDate && !isValidISODate(dueDate))
    errors.dueDate = "Informe uma data de vencimento válida.";

  if (!isTaskStatus(values.status)) errors.status = "Escolha uma coluna válida.";
  if (!isTaskPriority(values.priority)) errors.priority = "Escolha uma prioridade válida.";

  const assignees = [...new Set(values.assignees)];
  if (!assignees.every((id) => validAssignees.includes(id))) errors.assignees = "Escolha responsáveis válidos.";
  else if (assignees.length > MAX_ASSIGNEES)
    errors.assignees = `Marque no máximo ${MAX_ASSIGNEES} responsáveis.`;

  if (Object.keys(errors).length > 0) return { valid: false, errors };

  return {
    valid: true,
    value: {
      title,
      description: description || undefined,
      status: values.status,
      priority: values.priority,
      assignees,
      dueDate: dueDate || undefined,
    },
  };
}
