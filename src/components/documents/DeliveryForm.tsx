import { useState, type FormEvent } from "react";
import type {
  DeliveryFormErrors,
  DeliveryFormValues,
  DeliveryInput,
  OfficialDocument,
} from "../../types/officialDocument";
import { formatDueDate, todayISO } from "../../utils/date";
import { DOCUMENT_LIMITS, documentTitle, emptyDeliveryForm, validateDeliveryForm } from "../../utils/officialDocuments";
import { Button } from "../ui/Button";
import { CheckIcon } from "../ui/Icons";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";
const LABEL = "mb-1 block text-sm font-medium";

interface DeliveryFormProps {
  document: OfficialDocument;
  /** Devolve a mensagem de erro do servidor, ou `null` se deu certo. */
  onSubmit: (delivery: DeliveryInput) => Promise<string | null>;
  onCancel: () => void;
}

/** Marcar a entrega: mostra de qual documento se trata e pede o resumo, a data e quem recebeu. */
export function DeliveryForm({ document, onSubmit, onCancel }: DeliveryFormProps) {
  const [values, setValues] = useState<DeliveryFormValues>(() => emptyDeliveryForm(document));
  const [errors, setErrors] = useState<DeliveryFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(key: keyof DeliveryFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const a11y = (key: keyof DeliveryFormValues) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `delivery-${key}-error` : undefined,
  });

  const errorOf = (key: keyof DeliveryFormValues) =>
    errors[key] && (
      <p id={`delivery-${key}-error`} role="alert" className="mt-1 text-sm text-prio-urgent">
        {errors[key]}
      </p>
    );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateDeliveryForm(values, document.issuedOn);
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
      <div className="rounded-xl border border-line bg-canvas/40 px-3 py-2">
        <p className="card-title">{documentTitle(document)}</p>
        <p className="caption">
          {formatDueDate(document.issuedOn)} · Para: {document.recipient}
        </p>
        <p className="mt-1 break-words text-sm">{document.subject}</p>
      </div>

      <div>
        <label htmlFor="delivery-summary" className={LABEL}>
          Resumo do que se trata *
        </label>
        <textarea
          id="delivery-summary"
          data-autofocus
          rows={4}
          className={FIELD}
          value={values.summary}
          maxLength={DOCUMENT_LIMITS.summary}
          placeholder="Ex.: Encaminha a frequência dos servidores referente a outubro, com as faltas justificadas em anexo."
          onChange={(e) => set("summary", e.target.value)}
          {...a11y("summary")}
        />
        {errors.summary ? (
          errorOf("summary")
        ) : (
          <p className="mt-1 caption">Fica guardado com o documento, para consulta depois da entrega.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="delivery-deliveredOn" className={LABEL}>
            Entregue em *
          </label>
          <input
            id="delivery-deliveredOn"
            type="date"
            className={FIELD}
            value={values.deliveredOn}
            min={document.issuedOn}
            max={todayISO()}
            onChange={(e) => set("deliveredOn", e.target.value)}
            {...a11y("deliveredOn")}
          />
          {errorOf("deliveredOn")}
        </div>
        <div>
          <label htmlFor="delivery-receivedBy" className={LABEL}>
            Quem recebeu
          </label>
          <input
            id="delivery-receivedBy"
            className={FIELD}
            value={values.receivedBy}
            maxLength={DOCUMENT_LIMITS.receivedBy}
            placeholder="Nome de quem assinou o recebimento"
            onChange={(e) => set("receivedBy", e.target.value)}
            {...a11y("receivedBy")}
          />
          {errorOf("receivedBy")}
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
          <CheckIcon />
          {submitting ? "Salvando…" : "Marcar como entregue"}
        </Button>
      </div>
    </form>
  );
}
