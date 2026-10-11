import { useState, type FormEvent, type ReactNode } from "react";
import type { MemberFormErrors, MemberFormValues } from "../../types/directory";
import { PASSWORD_MIN, validateMemberForm } from "../../utils/userValidation";
import { Button } from "../ui/Button";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";

interface MemberFormProps {
  /** `create` pede e-mail e senha; `edit` permite trocar nome, senha e ativar/desativar. */
  mode: "create" | "edit";
  /** Mostra o campo da escola (cadastro do Master). */
  withSchoolName?: boolean;
  /** Nome da pessoa na edição. */
  initial?: { fullName: string; email: string; active: boolean };
  submitLabel: string;
  /** Devolve a mensagem de erro do servidor, ou `null` se deu certo. */
  onSubmit: (values: MemberFormValues) => Promise<string | null>;
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

export function MemberForm({
  mode,
  withSchoolName = false,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: MemberFormProps) {
  const [values, setValues] = useState<MemberFormValues>({
    schoolName: "",
    fullName: initial?.fullName ?? "",
    email: initial?.email ?? "",
    password: "",
    active: initial?.active ?? true,
  });
  const [errors, setErrors] = useState<MemberFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const creating = mode === "create";

  function set<K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const describe = (key: keyof MemberFormValues) => (errors[key] ? `member-${key}-error` : undefined);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateMemberForm(values, { creating, withSchoolName });
    setErrors(result.errors);
    setServerError(null);
    if (!result.valid) return;
    setSubmitting(true);
    const error = await onSubmit(values);
    setSubmitting(false);
    if (error) setServerError(error);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {withSchoolName && (
        <Field id="member-schoolName" label="Nome da escola *" error={errors.schoolName}>
          <input
            id="member-schoolName"
            data-autofocus
            className={FIELD}
            value={values.schoolName}
            maxLength={120}
            aria-invalid={Boolean(errors.schoolName)}
            aria-describedby={describe("schoolName")}
            onChange={(e) => set("schoolName", e.target.value)}
          />
        </Field>
      )}

      <Field id="member-fullName" label="Nome completo *" error={errors.fullName} hint="O sobrenome aparece como responsável nas tarefas.">
        <input
          id="member-fullName"
          data-autofocus={!withSchoolName || undefined}
          className={FIELD}
          value={values.fullName}
          maxLength={120}
          autoComplete="off"
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={describe("fullName")}
          onChange={(e) => set("fullName", e.target.value)}
        />
      </Field>

      <Field
        id="member-email"
        label={creating ? "E-mail *" : "E-mail"}
        error={errors.email}
        hint={creating ? undefined : "O e-mail não pode ser alterado."}
      >
        <input
          id="member-email"
          type="email"
          className={FIELD}
          value={values.email}
          disabled={!creating}
          autoComplete="off"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describe("email")}
          onChange={(e) => set("email", e.target.value)}
        />
      </Field>

      <Field
        id="member-password"
        label={creating ? "Senha inicial *" : "Nova senha"}
        error={errors.password}
        hint={
          creating
            ? `Mínimo de ${PASSWORD_MIN} caracteres. Informe a senha à pessoa por um canal seguro.`
            : "Deixe em branco para manter a senha atual."
        }
      >
        <input
          id="member-password"
          type="password"
          className={FIELD}
          value={values.password}
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={describe("password")}
          onChange={(e) => set("password", e.target.value)}
        />
      </Field>

      {!creating && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => set("active", e.target.checked)}
            className="h-4 w-4"
          />
          Acesso ativo
        </label>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-prio-urgent">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Salvando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
