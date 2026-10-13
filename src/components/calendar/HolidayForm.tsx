import { useState, type FormEvent } from "react";
import type { Holiday, HolidayFormErrors, HolidayFormValues, HolidayInput } from "../../types/calendar";
import { emptyHolidayForm, HOLIDAY_LIMITS, holidayToForm, validateHolidayForm } from "../../utils/holidays";
import { Button } from "../ui/Button";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";
const LABEL = "mb-1 block text-sm font-medium";

interface HolidayFormProps {
  /** Feriado sendo editado. Sem ele, o formulário cria um novo. */
  holiday?: Holiday;
  /** Data já preenchida ao criar (o dia escolhido no calendário). */
  initialDate?: string;
  /** Devolve a mensagem de erro do servidor, ou `null` se deu certo. */
  onSubmit: (input: HolidayInput) => Promise<string | null>;
  onCancel: () => void;
}

export function HolidayForm({ holiday, initialDate, onSubmit, onCancel }: HolidayFormProps) {
  const [values, setValues] = useState<HolidayFormValues>(() =>
    holiday ? holidayToForm(holiday) : emptyHolidayForm(initialDate),
  );
  const [errors, setErrors] = useState<HolidayFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(key: keyof HolidayFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const a11y = (key: keyof HolidayFormValues) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `holiday-${key}-error` : undefined,
  });

  const errorOf = (key: keyof HolidayFormValues) =>
    errors[key] && (
      <p id={`holiday-${key}-error`} role="alert" className="mt-1 text-sm text-prio-urgent">
        {errors[key]}
      </p>
    );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateHolidayForm(values);
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
      <div>
        <label htmlFor="holiday-name" className={LABEL}>
          Nome *
        </label>
        <input
          id="holiday-name"
          data-autofocus
          className={FIELD}
          value={values.name}
          maxLength={HOLIDAY_LIMITS.name}
          placeholder="Ex.: Aniversário da cidade"
          onChange={(e) => set("name", e.target.value)}
          {...a11y("name")}
        />
        {errorOf("name")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="holiday-start" className={LABEL}>
            Dia *
          </label>
          <input
            id="holiday-start"
            type="date"
            className={FIELD}
            value={values.start}
            onChange={(e) => set("start", e.target.value)}
            {...a11y("start")}
          />
          {errorOf("start")}
        </div>
        <div>
          <label htmlFor="holiday-end" className={LABEL}>
            Até o dia
          </label>
          <input
            id="holiday-end"
            type="date"
            className={FIELD}
            value={values.end}
            min={values.start || undefined}
            onChange={(e) => set("end", e.target.value)}
            {...a11y("end")}
          />
          {errors.end ? errorOf("end") : <p className="mt-1 caption">Só para recessos de vários dias.</p>}
        </div>
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-prio-urgent">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Salvando…" : holiday ? "Salvar alterações" : "Adicionar feriado"}
        </Button>
      </div>
    </form>
  );
}
