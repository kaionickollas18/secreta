import { useState, type FormEvent } from "react";
import {
  NOTE_KINDS,
  type Note,
  type NoteFormErrors,
  type NoteFormValues,
  type NoteInput,
  type NoteLink,
} from "../../types/note";
import { emptyNoteForm, NOTE_KIND_LABELS, NOTE_LIMITS, noteToForm, validateNoteForm } from "../../utils/notes";
import { Button } from "../ui/Button";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";
const LABEL = "mb-1 block text-sm font-medium";

export interface LinkOption {
  /** "task:<id>" ou "reminder:<id>". */
  value: string;
  label: string;
}

interface NoteFormProps {
  /** Nota sendo editada. Sem ela, o formulário cria uma nova. */
  note?: Note;
  /** Vínculo já escolhido ao criar (quando se chega pela tarefa ou pelo lembrete). */
  initialLink?: NoteLink;
  tasks: LinkOption[];
  reminders: LinkOption[];
  /** Devolve a mensagem de erro do servidor, ou `null` se deu certo. */
  onSubmit: (input: NoteInput) => Promise<string | null>;
  onCancel: () => void;
}

export function NoteForm({ note, initialLink, tasks, reminders, onSubmit, onCancel }: NoteFormProps) {
  const [values, setValues] = useState<NoteFormValues>(() =>
    note ? noteToForm(note) : emptyNoteForm(initialLink),
  );
  const [errors, setErrors] = useState<NoteFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof NoteFormValues>(key: K, value: NoteFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const a11y = (key: keyof NoteFormValues) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `note-${key}-error` : undefined,
  });

  const errorOf = (key: keyof NoteFormValues) =>
    errors[key] && (
      <p id={`note-${key}-error`} role="alert" className="mt-1 text-sm text-prio-urgent">
        {errors[key]}
      </p>
    );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateNoteForm(values, note?.items);
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

  // Um vínculo que não está mais nas listas (tarefa de outra tela) continua selecionável.
  const known = [...tasks, ...reminders].some((option) => option.value === values.link);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="note-title" className={LABEL}>
          Título *
        </label>
        <input
          id="note-title"
          data-autofocus
          className={FIELD}
          value={values.title}
          maxLength={NOTE_LIMITS.title}
          placeholder="Ex.: Ornamentação da festa junina"
          onChange={(e) => set("title", e.target.value)}
          {...a11y("title")}
        />
        {errorOf("title")}
      </div>

      <fieldset>
        <legend className={LABEL}>Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {NOTE_KINDS.map((kind) => (
            <label
              key={kind}
              className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
                values.kind === kind ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:bg-raised/60"
              }`}
            >
              <input
                type="radio"
                name="note-kind"
                value={kind}
                checked={values.kind === kind}
                onChange={() => set("kind", kind)}
              />
              {NOTE_KIND_LABELS[kind]}
            </label>
          ))}
        </div>
      </fieldset>

      {values.kind === "checklist" ? (
        <div>
          <label htmlFor="note-itemsText" className={LABEL}>
            Itens *
          </label>
          <textarea
            id="note-itemsText"
            rows={6}
            className={FIELD}
            value={values.itemsText}
            placeholder={"Balões\nFita adesiva\nToalhas de mesa"}
            onChange={(e) => set("itemsText", e.target.value)}
            {...a11y("itemsText")}
          />
          {errors.itemsText ? (
            errorOf("itemsText")
          ) : (
            <p className="mt-1 caption">
              Um item por linha. {note ? "Os itens já marcados continuam marcados." : "Depois é só marcar o que já foi resolvido."}
            </p>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="note-body" className={LABEL}>
            Texto
          </label>
          <textarea
            id="note-body"
            rows={6}
            className={FIELD}
            value={values.body}
            maxLength={NOTE_LIMITS.body}
            placeholder="Escreva a anotação"
            onChange={(e) => set("body", e.target.value)}
            {...a11y("body")}
          />
          {errorOf("body")}
        </div>
      )}

      <div>
        <label htmlFor="note-link" className={LABEL}>
          Vincular a
        </label>
        <select id="note-link" className={FIELD} value={values.link} onChange={(e) => set("link", e.target.value)}>
          <option value="">Nada (nota solta)</option>
          {!known && values.link !== "" && <option value={values.link}>Vínculo atual</option>}
          {tasks.length > 0 && (
            <optgroup label="Tarefas">
              {tasks.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          )}
          {reminders.length > 0 && (
            <optgroup label="Lembretes">
              {reminders.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <p className="mt-1 caption">A nota vinculada aparece ao abrir a tarefa ou no cartão do lembrete.</p>
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-prio-urgent">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Salvando…" : note ? "Salvar alterações" : "Criar nota"}
        </Button>
      </div>
    </form>
  );
}
