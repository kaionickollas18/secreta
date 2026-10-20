import { useState, type FormEvent, type ReactNode } from "react";
import type { MemberFormErrors, MemberFormValues } from "../../types/directory";
import { LAST_NAME_MAX, NICKNAME_MAX, validateStaffProfile } from "../../utils/profileForm";
import { MANAGED_ROLES, ROLE_LABELS, type ManagedRole } from "../../utils/roles";
import { PASSWORD_MIN, validateMemberForm } from "../../utils/userValidation";
import { Button } from "../ui/Button";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";

const ROLE_HINTS: Record<ManagedRole, string> = {
  assistant: "Trabalha na secretaria: quadro, lembretes, notas, documentos e conversas.",
  teacher: "Conversas, calendário e dashboard. Não vê o quadro nem os documentos da secretaria.",
};

/** Dados atuais da pessoa, na edição. */
interface MemberInitial {
  fullName: string;
  email: string;
  active: boolean;
  role?: ManagedRole;
  lastName?: string;
  nickname?: string;
  birthDate?: string;
  hasPhoto?: boolean;
}

interface MemberFormProps {
  /** `create` pede e-mail e senha; `edit` permite trocar os dados e ativar/desativar. */
  mode: "create" | "edit";
  /** Mostra o campo da escola (cadastro do Master). */
  withSchoolName?: boolean;
  /**
   * Equipe da escola (área do secretário): escolhe auxiliar ou professor e, na edição, altera
   * livremente o perfil (sobrenome, apelido, nascimento, e-mail, foto).
   */
  staff?: boolean;
  initial?: MemberInitial;
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

const lastWord = (name: string) => name.trim().split(/\s+/).pop() ?? "";

export function MemberForm({
  mode,
  withSchoolName = false,
  staff = false,
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
    role: initial?.role ?? "assistant",
    lastName: initial?.lastName ?? "",
    nickname: initial?.nickname ?? "",
    birthDate: initial?.birthDate ?? "",
    removePhoto: false,
  });
  // O sobrenome acompanha o nome completo até a pessoa mexer nele.
  const [lastNameTouched, setLastNameTouched] = useState(
    initial?.lastName !== undefined && initial.lastName !== lastWord(initial.fullName),
  );
  const [errors, setErrors] = useState<MemberFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const creating = mode === "create";
  const editingProfile = staff && !creating;

  function set<K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setFullName(fullName: string) {
    setValues((current) => ({
      ...current,
      fullName,
      ...(editingProfile && !lastNameTouched ? { lastName: lastWord(fullName) } : {}),
    }));
  }

  const describe = (key: keyof MemberFormValues) => (errors[key] ? `member-${key}-error` : undefined);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const base = validateMemberForm(values, { creating, withSchoolName });
    const profile = editingProfile ? validateStaffProfile(values) : { valid: true, errors: {} };
    setErrors({ ...base.errors, ...profile.errors });
    setServerError(null);
    if (!base.valid || !profile.valid) return;
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

      {staff && (
        <fieldset>
          <legend className="mb-1 block text-sm font-medium">Papel *</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {MANAGED_ROLES.map((role) => (
              <div
                key={role}
                className={`rounded-xl border p-3 text-sm ${
                  values.role === role ? "border-accent/60 bg-accent-soft" : "border-line bg-canvas/40"
                }`}
              >
                <label className="flex cursor-pointer items-center gap-2 font-semibold">
                  <input
                    type="radio"
                    name="member-role"
                    value={role}
                    checked={values.role === role}
                    aria-describedby={`member-role-${role}-hint`}
                    onChange={() => set("role", role)}
                    className="h-4 w-4"
                  />
                  {ROLE_LABELS[role]}
                </label>
                <p id={`member-role-${role}-hint`} className="mt-1 caption">
                  {ROLE_HINTS[role]}
                </p>
              </div>
            ))}
          </div>
          {editingProfile && initial?.role === "assistant" && values.role === "teacher" && (
            <p className="mt-2 caption">
              Ao virar professor(a), a pessoa sai dos responsáveis das tarefas e perde o acesso de secretário, se tiver.
            </p>
          )}
        </fieldset>
      )}

      <Field
        id="member-fullName"
        label="Nome completo *"
        error={errors.fullName}
        hint={editingProfile ? undefined : "O sobrenome aparece como responsável nas tarefas."}
      >
        <input
          id="member-fullName"
          data-autofocus={!withSchoolName || undefined}
          className={FIELD}
          value={values.fullName}
          maxLength={120}
          autoComplete="off"
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={describe("fullName")}
          onChange={(e) => setFullName(e.target.value)}
        />
      </Field>

      {editingProfile && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="member-lastName"
            label="Sobrenome *"
            error={errors.lastName}
            hint="Como aparece nas tarefas e nas conversas."
          >
            <input
              id="member-lastName"
              className={FIELD}
              value={values.lastName}
              maxLength={LAST_NAME_MAX}
              autoComplete="off"
              aria-invalid={Boolean(errors.lastName)}
              aria-describedby={describe("lastName")}
              onChange={(e) => {
                setLastNameTouched(true);
                set("lastName", e.target.value);
              }}
            />
          </Field>
          <Field id="member-nickname" label="Apelido" error={errors.nickname}>
            <input
              id="member-nickname"
              className={FIELD}
              value={values.nickname}
              maxLength={NICKNAME_MAX}
              autoComplete="off"
              aria-invalid={Boolean(errors.nickname)}
              aria-describedby={describe("nickname")}
              onChange={(e) => set("nickname", e.target.value)}
            />
          </Field>
          <Field id="member-birthDate" label="Data de nascimento" error={errors.birthDate}>
            <input
              id="member-birthDate"
              type="date"
              className={FIELD}
              value={values.birthDate}
              aria-invalid={Boolean(errors.birthDate)}
              aria-describedby={describe("birthDate")}
              onChange={(e) => set("birthDate", e.target.value)}
            />
          </Field>
        </div>
      )}

      <Field
        id="member-email"
        label={creating || editingProfile ? "E-mail *" : "E-mail"}
        error={errors.email}
        hint={
          editingProfile
            ? "É o login da pessoa. Ao trocar, avise: ela passa a entrar com o e-mail novo."
            : creating
              ? undefined
              : "O e-mail não pode ser alterado."
        }
      >
        <input
          id="member-email"
          type="email"
          className={FIELD}
          value={values.email}
          disabled={!creating && !editingProfile}
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

      {editingProfile && initial?.hasPhoto && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.removePhoto}
            onChange={(e) => set("removePhoto", e.target.checked)}
            className="h-4 w-4"
          />
          Remover a foto de perfil
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
