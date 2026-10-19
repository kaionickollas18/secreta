import { useState, type FormEvent } from "react";
import {
  DOCUMENT_KINDS,
  type DocumentFormErrors,
  type DocumentFormValues,
  type DocumentInput,
  type DocumentKind,
  type OfficialDocument,
} from "../../types/officialDocument";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_LIMITS,
  documentToForm,
  emptyDocumentForm,
  validateDocumentForm,
} from "../../utils/officialDocuments";
import { Button } from "../ui/Button";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";
const LABEL = "mb-1 block text-sm font-medium";

interface DocumentFormProps {
  /** Documento sendo editado. Sem ele, o formulário registra um novo. */
  document?: OfficialDocument;
  /** Tipo e número já preenchidos ao criar pelo quadro de números. */
  preset?: { kind: DocumentKind; number: string };
  /** Devolve a mensagem de erro do servidor, ou `null` se deu certo. */
  onSubmit: (input: DocumentInput) => Promise<string | null>;
  onCancel: () => void;
}

export function DocumentForm({ document, preset, onSubmit, onCancel }: DocumentFormProps) {
  const [values, setValues] = useState<DocumentFormValues>(() =>
    document ? documentToForm(document) : emptyDocumentForm(undefined, preset),
  );
  const [errors, setErrors] = useState<DocumentFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof DocumentFormValues>(key: K, value: DocumentFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const a11y = (key: keyof DocumentFormValues) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `document-${key}-error` : undefined,
  });

  const errorOf = (key: keyof DocumentFormValues) =>
    errors[key] && (
      <p id={`document-${key}-error`} role="alert" className="mt-1 text-sm text-prio-urgent">
        {errors[key]}
      </p>
    );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateDocumentForm(
      values,
      document?.deliveredOn ? { deliveredOn: document.deliveredOn } : undefined,
    );
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="document-kind" className={LABEL}>
            Tipo
          </label>
          <select
            id="document-kind"
            className={FIELD}
            value={values.kind}
            onChange={(e) => {
              const next = DOCUMENT_KINDS.find((kind) => kind === e.target.value);
              if (next) set("kind", next);
            }}
          >
            {DOCUMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {DOCUMENT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="document-number" className={LABEL}>
            Número *
          </label>
          <input
            id="document-number"
            data-autofocus={preset ? undefined : true}
            className={FIELD}
            value={values.number}
            maxLength={DOCUMENT_LIMITS.number}
            placeholder="Ex.: 012/2026"
            onChange={(e) => set("number", e.target.value)}
            {...a11y("number")}
          />
          {errorOf("number")}
        </div>
        <div>
          <label htmlFor="document-issuedOn" className={LABEL}>
            Data *
          </label>
          <input
            id="document-issuedOn"
            type="date"
            className={FIELD}
            value={values.issuedOn}
            onChange={(e) => set("issuedOn", e.target.value)}
            {...a11y("issuedOn")}
          />
          {errorOf("issuedOn")}
        </div>
      </div>

      <div>
        <label htmlFor="document-recipient" className={LABEL}>
          Para quem *
        </label>
        <input
          id="document-recipient"
          data-autofocus={preset ? true : undefined}
          className={FIELD}
          value={values.recipient}
          maxLength={DOCUMENT_LIMITS.recipient}
          placeholder="Ex.: Secretaria Municipal de Educação"
          onChange={(e) => set("recipient", e.target.value)}
          {...a11y("recipient")}
        />
        {errorOf("recipient")}
      </div>

      <div>
        <label htmlFor="document-subject" className={LABEL}>
          Assunto *
        </label>
        <input
          id="document-subject"
          className={FIELD}
          value={values.subject}
          maxLength={DOCUMENT_LIMITS.subject}
          placeholder="Ex.: Frequência de pessoal de outubro"
          onChange={(e) => set("subject", e.target.value)}
          {...a11y("subject")}
        />
        {errorOf("subject")}
      </div>

      <div>
        <label htmlFor="document-summary" className={LABEL}>
          Resumo
        </label>
        <textarea
          id="document-summary"
          rows={4}
          className={FIELD}
          value={values.summary}
          maxLength={DOCUMENT_LIMITS.summary}
          placeholder="Do que se trata o documento"
          onChange={(e) => set("summary", e.target.value)}
          {...a11y("summary")}
        />
        {errors.summary ? (
          errorOf("summary")
        ) : (
          <p className="mt-1 caption">Pode ficar para depois: ele é pedido na hora de marcar a entrega.</p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-prio-urgent">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Salvando…" : document ? "Salvar alterações" : "Registrar documento"}
        </Button>
      </div>
    </form>
  );
}
