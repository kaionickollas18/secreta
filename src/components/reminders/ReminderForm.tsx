import { useState, type FormEvent, type ReactNode } from "react";
import {
  REMINDER_KINDS,
  type Reminder,
  type ReminderFormErrors,
  type ReminderFormValues,
  type ReminderInput,
  type ReminderKind,
} from "../../types/reminder";
import {
  emptyReminderForm,
  MONTH_INTERVALS,
  REMINDER_LIMITS,
  reminderToForm,
  validateReminderForm,
  WEEKDAY_LABELS,
} from "../../utils/reminders";
import { Button } from "../ui/Button";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";

const KIND_LABELS: Record<ReminderKind, string> = {
  monthly: "Todo mês ou a cada alguns meses",
  weekly: "Toda semana",
  once: "Uma única vez",
};

function intervalLabel(months: number): string {
  if (months === 1) return "Todo mês";
  if (months === 12) return "Uma vez por ano";
  return `A cada ${months} meses`;
}

interface ReminderFormProps {
  /** Lembrete sendo editado. Sem ele, o formulário cria um novo. */
  reminder?: Reminder;
  /** Devolve a mensagem de erro do servidor, ou `null` se deu certo. */
  onSubmit: (input: ReminderInput) => Promise<string | null>;
  onCancel: () => void;
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 caption">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-prio-urgent">
          {error}
        </p>
      )}
    </div>
  );
}

export function ReminderForm({ reminder, onSubmit, onCancel }: ReminderFormProps) {
  const [values, setValues] = useState<ReminderFormValues>(() =>
    reminder ? reminderToForm(reminder) : emptyReminderForm(),
  );
  const [errors, setErrors] = useState<ReminderFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ReminderFormValues>(key: K, value: ReminderFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  /** Atributos de acessibilidade comuns a um campo com possível erro. */
  const a11y = (key: keyof ReminderFormValues) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `reminder-${key}-error` : undefined,
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateReminderForm(values, undefined, reminder !== undefined);
    setServerError(null);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const error = await onSubmit(result.value);
    setSubmitting(false);
    if (error) setServerError(error);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field id="reminder-title" label="O que lembrar *" error={errors.title}>
        <input
          id="reminder-title"
          data-autofocus
          className={FIELD}
          value={values.title}
          maxLength={REMINDER_LIMITS.title}
          placeholder="Ex.: Entregar memorando com a frequência de pessoal"
          onChange={(e) => set("title", e.target.value)}
          {...a11y("title")}
        />
      </Field>

      <Field id="reminder-notes" label="Observações" error={errors.notes}>
        <textarea
          id="reminder-notes"
          rows={3}
          className={FIELD}
          value={values.notes}
          maxLength={REMINDER_LIMITS.notes}
          placeholder="Ex.: anexar a frequência de toda a escola"
          onChange={(e) => set("notes", e.target.value)}
          {...a11y("notes")}
        />
      </Field>

      <Field id="reminder-kind" label="Repetição">
        <select
          id="reminder-kind"
          className={FIELD}
          value={values.kind}
          onChange={(e) => {
            const next = REMINDER_KINDS.find((k) => k === e.target.value);
            if (next) set("kind", next);
          }}
        >
          {REMINDER_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </Field>

      {values.kind === "monthly" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="reminder-intervalMonths" label="De quanto em quanto tempo" error={errors.intervalMonths}>
              <select
                id="reminder-intervalMonths"
                className={FIELD}
                value={values.intervalMonths}
                onChange={(e) => set("intervalMonths", e.target.value)}
                {...a11y("intervalMonths")}
              >
                {MONTH_INTERVALS.map((months) => (
                  <option key={months} value={months}>
                    {intervalLabel(months)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id="reminder-startMonth"
              label="A partir de (mês) *"
              error={errors.startMonth}
              hint="Formato AAAA-MM, ex.: 2026-10. Define em quais meses o lembrete cai."
            >
              <input
                id="reminder-startMonth"
                type="month"
                className={FIELD}
                value={values.startMonth}
                placeholder="AAAA-MM"
                onChange={(e) => set("startMonth", e.target.value)}
                {...a11y("startMonth")}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="reminder-dayStart" label="Do dia *" error={errors.dayStart}>
              <input
                id="reminder-dayStart"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                className={FIELD}
                value={values.dayStart}
                placeholder="15"
                onChange={(e) => set("dayStart", e.target.value)}
                {...a11y("dayStart")}
              />
            </Field>
            <Field
              id="reminder-dayEnd"
              label="Até o dia *"
              error={errors.dayEnd}
              hint="Para um dia só, repita o mesmo número."
            >
              <input
                id="reminder-dayEnd"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                className={FIELD}
                value={values.dayEnd}
                placeholder="20"
                onChange={(e) => set("dayEnd", e.target.value)}
                {...a11y("dayEnd")}
              />
            </Field>
          </div>
        </>
      )}

      {values.kind === "weekly" && (
        <Field id="reminder-weekday" label="Dia da semana" error={errors.weekday}>
          <select
            id="reminder-weekday"
            className={FIELD}
            value={values.weekday}
            onChange={(e) => set("weekday", e.target.value)}
            {...a11y("weekday")}
          >
            {WEEKDAY_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </option>
            ))}
          </select>
        </Field>
      )}

      {values.kind === "once" && (
        <Field id="reminder-dueDate" label="Data *" error={errors.dueDate}>
          <input
            id="reminder-dueDate"
            type="date"
            className={FIELD}
            value={values.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
            {...a11y("dueDate")}
          />
        </Field>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-prio-urgent">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Salvando…" : reminder ? "Salvar alterações" : "Criar lembrete"}
        </Button>
      </div>
    </form>
  );
}
