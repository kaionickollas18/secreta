import { useState, type FormEvent } from "react";
import { LIMITS, MAX_ASSIGNEES, PRIORITY_LABELS, STATUS_LABELS } from "../../constants/board";
import { useBoardAccess } from "../../hooks/useBoardAccess";
import type { Member } from "../../types/directory";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type FieldErrors,
  type Task,
  type TaskFormValues,
  type TaskInput,
  type TaskStatus,
} from "../../types/task";
import { isTaskPriority, isTaskStatus } from "../../utils/guards";
import { validateTaskForm } from "../../utils/validation";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";

interface TaskFormProps {
  /** Tarefa sendo editada. Sem ela, o formulário cria uma nova. */
  task?: Task;
  defaultStatus?: TaskStatus;
  onSubmit: (input: TaskInput) => void;
  onCancel: () => void;
}

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";

export function TaskForm({ task, defaultStatus = "todo", onSubmit, onCancel }: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? defaultStatus,
    priority: task?.priority ?? "medium",
    assignees: task?.assignees ?? [],
    dueDate: task?.dueDate ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const { canManage, canApprove, people, personOf } = useBoardAccess();

  // Quem já é responsável continua na lista mesmo que tenha sido desativado depois.
  const toOption = (p: Member) => ({
    id: p.id,
    name: p.lastName,
    fullName: p.fullName,
    avatarUrl: p.avatarUrl,
  });
  const options = [
    ...people.map(toOption),
    ...(task?.assignees ?? []).flatMap((id) => {
      const person = personOf(id);
      return !person || people.some((p) => p.id === id) ? [] : [toOption(person)];
    }),
  ];
  /** Responsáveis atuais, na ordem em que foram marcados (visão somente leitura). */
  const assigned = values.assignees.flatMap((id) => options.find((o) => o.id === id) ?? []);
  // O Assistente não conclui nem reabre: "Concluído" só aparece se a tarefa já estiver lá.
  const lockedDone = !canApprove && task?.status === "done";
  // Tarefa nova também não nasce concluída (o banco recusa).
  const canPickDone = lockedDone || (canApprove && task !== undefined);
  const statuses = TASK_STATUSES.filter((s) => s !== "done" || canPickDone);

  function set<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateTaskForm(
      values,
      options.map((o) => o.id),
    );
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.value);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="task-title" className="mb-1 block text-sm font-medium">
          Título<span aria-hidden="true"> *</span>
        </label>
        <input
          id="task-title"
          data-autofocus
          className={FIELD}
          value={values.title}
          maxLength={LIMITS.title}
          required
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "task-title-error" : undefined}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ex.: Revisar proposta do cliente"
        />
        {errors.title && (
          <p id="task-title-error" role="alert" className="mt-1 text-sm text-prio-urgent">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="task-description" className="mb-1 block text-sm font-medium">
          Descrição
        </label>
        <textarea
          id="task-description"
          rows={4}
          className={FIELD}
          value={values.description}
          maxLength={LIMITS.description}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "task-description-error" : undefined}
          onChange={(e) => set("description", e.target.value)}
        />
        {errors.description && (
          <p id="task-description-error" role="alert" className="mt-1 text-sm text-prio-urgent">
            {errors.description}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="task-status" className="mb-1 block text-sm font-medium">
            Coluna
          </label>
          <select
            id="task-status"
            className={FIELD}
            value={values.status}
            disabled={lockedDone}
            aria-describedby={canApprove ? undefined : "task-status-hint"}
            onChange={(e) => {
              const next = e.target.value;
              if (isTaskStatus(next)) set("status", next);
            }}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          {!canApprove && (
            <p id="task-status-hint" className="mt-1 caption">
              {lockedDone
                ? "Só o secretário reabre uma tarefa concluída."
                : "Para concluir, use “Pedir conclusão” no cartão."}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="task-priority" className="mb-1 block text-sm font-medium">
            Prioridade
          </label>
          <select
            id="task-priority"
            className={FIELD}
            value={values.priority}
            onChange={(e) => {
              const next = e.target.value;
              if (isTaskPriority(next)) set("priority", next);
            }}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canManage ? (
        <fieldset aria-describedby="task-assignees-hint">
          <legend className="mb-1 text-sm font-medium">Responsáveis</legend>
          <ul className="space-y-1.5">
            {options.map((person) => {
              const checked = values.assignees.includes(person.id);
              const blocked = !checked && values.assignees.length >= MAX_ASSIGNEES;
              return (
                <li key={person.id}>
                  <label
                    className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-1.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-light ${
                      checked ? "border-accent/60 bg-accent-soft" : "border-line hover:bg-raised/50"
                    } ${blocked ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <Avatar id={person.id} name={person.name} url={person.avatarUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">@{person.name}</span>
                      <span className="block truncate text-xs text-muted">{person.fullName}</span>
                    </span>
                    <input
                      type="checkbox"
                      aria-label={`@${person.name}`}
                      className="h-4 w-4 shrink-0"
                      checked={checked}
                      disabled={blocked}
                      onChange={() =>
                        set(
                          "assignees",
                          checked
                            ? values.assignees.filter((id) => id !== person.id)
                            : [...values.assignees, person.id],
                        )
                      }
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          <p id="task-assignees-hint" className="mt-1 text-xs text-muted">
            {options.length === 0
              ? "Nenhuma pessoa cadastrada. Cadastre assistentes em Equipe."
              : `Marque até ${MAX_ASSIGNEES} pessoas.`}
          </p>
          {errors.assignees && (
            <p role="alert" className="mt-1 text-sm text-prio-urgent">
              {errors.assignees}
            </p>
          )}
        </fieldset>
      ) : (
        <div>
          <p className="mb-1 text-sm font-medium">Responsáveis</p>
          {assigned.length > 0 ? (
            <ul className="space-y-1.5">
              {assigned.map((person) => (
                <li key={person.id} className="flex min-h-[52px] items-center gap-3 rounded-xl border border-line px-3 py-1.5">
                  <Avatar id={person.id} name={person.name} url={person.avatarUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">@{person.name}</span>
                    <span className="block truncate text-xs text-muted">{person.fullName}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-muted">Sem responsável</p>
          )}
          <p className="mt-1 text-xs text-muted">Só o secretário define os responsáveis.</p>
        </div>
      )}
      <div>
        <label htmlFor="task-due" className="mb-1 block text-sm font-medium">
          Data de vencimento
        </label>
        <input
          id="task-due"
          type="date"
          className={FIELD}
          value={values.dueDate}
          aria-invalid={Boolean(errors.dueDate)}
          aria-describedby={errors.dueDate ? "task-due-error" : undefined}
          onChange={(e) => set("dueDate", e.target.value)}
        />
        {errors.dueDate && (
          <p id="task-due-error" role="alert" className="mt-1 text-sm text-prio-urgent">
            {errors.dueDate}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary">
          {task ? "Salvar alterações" : "Criar tarefa"}
        </Button>
      </div>
    </form>
  );
}
