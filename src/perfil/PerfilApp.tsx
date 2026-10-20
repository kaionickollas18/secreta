import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { TeamSection } from "../components/profile/TeamSection";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { LogoutIcon } from "../components/ui/Icons";
import { ToastViewport } from "../components/ui/ToastViewport";
import { useAuthStore } from "../store/authStore";
import { useDirectoryStore } from "../store/directoryStore";
import { useTaskStore } from "../store/taskStore";
import { useToastStore } from "../store/toastStore";
import { chatHref } from "../utils/chat";
import {
  LAST_NAME_MAX,
  NICKNAME_MAX,
  preparePhoto,
  validateLastName,
  validatePasswordForm,
  validatePersonalDetails,
  validatePhotoFile,
  type PasswordErrors,
  type PasswordForm,
  type PersonalErrors,
} from "../utils/profileForm";
import { isSchoolRole, roleLabel } from "../utils/roles";
import { PASSWORD_MIN } from "../utils/userValidation";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";
const SECTION = "glass rounded-3xl p-5";
const EMPTY_PASSWORD: PasswordForm = { current: "", next: "", confirm: "" };

/**
 * Perfil próprio: cada pessoa troca a foto, o sobrenome, o apelido, o nascimento e a senha.
 * Também lista as pessoas da escola, com o perfil de cada uma para leitura.
 */
export default function PerfilApp() {
  const profile = useAuthStore((s) => s.profile);
  const { saveLastName, savePhoto, removePhoto, changePassword, signOut } = useAuthStore();
  const pushToast = useToastStore((s) => s.push);

  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [password, setPassword] = useState<PasswordForm>(EMPTY_PASSWORD);
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [busy, setBusy] = useState<"photo" | "name" | "personal" | "password" | null>(null);
  const members = useDirectoryStore((s) => s.members);
  const loadDirectory = useDirectoryStore((s) => s.load);
  const savePersonalDetails = useDirectoryStore((s) => s.savePersonalDetails);
  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.load);
  const [personal, setPersonal] = useState({ nickname: "", birthDate: "" });
  const [personalErrors, setPersonalErrors] = useState<PersonalErrors>({});

  const userId = profile?.id;
  const inSchool = profile ? isSchoolRole(profile.role) : false;
  // Apelido e nascimento vêm do cadastro (o perfil da sessão guarda só o que a moldura usa).
  const me = members.find((m) => m.id === userId);
  const savedNickname = me?.nickname ?? "";
  const savedBirthDate = me?.birthDate ?? "";

  useEffect(() => {
    if (!userId) return;
    void loadDirectory();
    if (inSchool) void loadTasks();
  }, [userId, inSchool, loadDirectory, loadTasks]);

  // Preenche o formulário quando o cadastro chega (ou muda depois de salvar).
  useEffect(() => {
    setPersonal({ nickname: savedNickname, birthDate: savedBirthDate });
  }, [savedNickname, savedBirthDate]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!profile) return null;

  /** Avisa o resultado. Devolve `true` quando deu certo. */
  function report(error: string | null, success: string): boolean {
    pushToast(error ? { tone: "error", message: error } : { tone: "success", message: success });
    return !error;
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permite escolher o mesmo arquivo de novo depois.
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    const problem = validatePhotoFile(file);
    setPhotoError(problem);
    if (problem) return;

    setBusy("photo");
    try {
      const image = await preparePhoto(file);
      report(await savePhoto(image), "Foto atualizada.");
    } catch {
      setPhotoError("Não foi possível ler essa imagem. Tente outra foto.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemovePhoto() {
    setConfirmRemove(false);
    setBusy("photo");
    report(await removePhoto(), "Foto removida.");
    setBusy(null);
  }

  async function handleLastName(event: FormEvent) {
    event.preventDefault();
    const result = validateLastName(lastName);
    if (!result.valid) {
      setLastNameError(result.error);
      return;
    }
    setLastNameError(null);
    setBusy("name");
    if (report(await saveLastName(result.value), "Sobrenome atualizado.")) setLastName(result.value);
    setBusy(null);
  }

  async function handlePersonal(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    const result = validatePersonalDetails(personal);
    setPersonalErrors(result.valid ? {} : result.errors);
    if (!result.valid) return;
    setBusy("personal");
    report(await savePersonalDetails(profile.id, result.value), "Dados atualizados.");
    setBusy(null);
  }

  async function handlePassword(event: FormEvent) {
    event.preventDefault();
    const result = validatePasswordForm(password);
    setPasswordErrors(result.errors);
    if (!result.valid) return;
    setBusy("password");
    const error = await changePassword(password.current, password.next);
    setBusy(null);
    if (error) {
      // O erro mais comum é a senha atual: mostra junto do campo.
      if (error.includes("atual")) setPasswordErrors({ current: error });
      else pushToast({ tone: "error", message: error });
      return;
    }
    setPassword(EMPTY_PASSWORD);
    pushToast({ tone: "success", message: "Senha alterada." });
  }

  const setPasswordField = (key: keyof PasswordForm) => (event: ChangeEvent<HTMLInputElement>) =>
    setPassword((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="mx-auto flex min-h-screen max-w-[720px] flex-col gap-5 px-4 py-5 sm:px-6">
      <header>
        <h1 className="page-title">Meu perfil</h1>
        <p className="page-lede">
          {profile.fullName} · {roleLabel(profile)}
        </p>
      </header>

      <main className="flex flex-col gap-5">
        <section className={SECTION} aria-labelledby="h-photo">
          <h2 id="h-photo" className="section-title">
            Foto
          </h2>
          <p className="caption mt-1">
            Aparece nas tarefas em que você é responsável. Qualquer pessoa da sua escola pode vê-la.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Avatar
              id={profile.id}
              name={profile.lastName}
              url={profile.avatarUrl}
              className="h-24 w-24 text-3xl"
            />
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                id="profile-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                // Quem abre o seletor é o botão ao lado; o campo em si fica fora da navegação.
                tabIndex={-1}
                aria-label="Arquivo da foto de perfil"
                aria-describedby={photoError ? "profile-photo-error" : "profile-photo-hint"}
                onChange={(event) => void handlePhoto(event)}
              />
              <Button
                variant="primary"
                disabled={busy === "photo"}
                onClick={() => fileInput.current?.click()}
              >
                {busy === "photo" ? "Enviando…" : profile.avatarUrl ? "Trocar foto" : "Escolher foto"}
              </Button>
              {profile.avatarUrl && (
                <Button disabled={busy === "photo"} onClick={() => setConfirmRemove(true)}>
                  Remover foto
                </Button>
              )}
            </div>
          </div>
          {photoError ? (
            <p id="profile-photo-error" role="alert" className="mt-3 text-sm text-prio-urgent">
              {photoError}
            </p>
          ) : (
            <p id="profile-photo-hint" className="caption mt-3">
              JPG, PNG ou WebP. A foto é recortada em quadrado e reduzida antes de ser enviada.
            </p>
          )}
        </section>

        <section className={SECTION} aria-labelledby="h-name">
          <h2 id="h-name" className="section-title">
            Sobrenome
          </h2>
          <form onSubmit={handleLastName} noValidate className="mt-3 space-y-3">
            <div>
              <label htmlFor="profile-last-name" className="mb-1 block text-sm font-medium">
                Como você aparece nas tarefas
              </label>
              <input
                id="profile-last-name"
                className={FIELD}
                value={lastName}
                maxLength={LAST_NAME_MAX}
                autoComplete="family-name"
                aria-invalid={Boolean(lastNameError)}
                aria-describedby={lastNameError ? "profile-last-name-error" : "profile-last-name-hint"}
                onChange={(event) => setLastName(event.target.value)}
              />
              {lastNameError ? (
                <p id="profile-last-name-error" role="alert" className="mt-1 text-sm text-prio-urgent">
                  {lastNameError}
                </p>
              ) : (
                <p id="profile-last-name-hint" className="caption mt-1">
                  O nome completo só pode ser alterado por quem fez o seu cadastro.
                </p>
              )}
            </div>
            <Button type="submit" variant="primary" disabled={busy === "name" || lastName.trim() === profile.lastName}>
              {busy === "name" ? "Salvando…" : "Salvar sobrenome"}
            </Button>
          </form>
        </section>

        <section className={SECTION} aria-labelledby="h-personal">
          <h2 id="h-personal" className="section-title">
            Apelido e nascimento
          </h2>
          <p className="caption mt-1">Opcionais. Aparecem no seu perfil para as pessoas da sua escola.</p>
          <form onSubmit={handlePersonal} noValidate className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-nickname" className="mb-1 block text-sm font-medium">
                  Apelido
                </label>
                <input
                  id="profile-nickname"
                  className={FIELD}
                  value={personal.nickname}
                  maxLength={NICKNAME_MAX}
                  autoComplete="nickname"
                  placeholder="Como gosta de ser chamado(a)"
                  aria-invalid={Boolean(personalErrors.nickname)}
                  aria-describedby={personalErrors.nickname ? "profile-nickname-error" : undefined}
                  onChange={(event) => setPersonal((current) => ({ ...current, nickname: event.target.value }))}
                />
                {personalErrors.nickname && (
                  <p id="profile-nickname-error" role="alert" className="mt-1 text-sm text-prio-urgent">
                    {personalErrors.nickname}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="profile-birth-date" className="mb-1 block text-sm font-medium">
                  Data de nascimento
                </label>
                <input
                  id="profile-birth-date"
                  type="date"
                  className={FIELD}
                  value={personal.birthDate}
                  autoComplete="bday"
                  aria-invalid={Boolean(personalErrors.birthDate)}
                  aria-describedby={personalErrors.birthDate ? "profile-birth-date-error" : undefined}
                  onChange={(event) => setPersonal((current) => ({ ...current, birthDate: event.target.value }))}
                />
                {personalErrors.birthDate && (
                  <p id="profile-birth-date-error" role="alert" className="mt-1 text-sm text-prio-urgent">
                    {personalErrors.birthDate}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={
                busy === "personal" ||
                !me ||
                (personal.nickname.trim() === savedNickname && personal.birthDate === savedBirthDate)
              }
            >
              {busy === "personal" ? "Salvando…" : "Salvar apelido e nascimento"}
            </Button>
          </form>
        </section>

        {inSchool && profile.schoolId && (
          <TeamSection
            className={SECTION}
            members={members}
            schoolId={profile.schoolId}
            currentUserId={profile.id}
            tasks={tasks}
            onStartChat={(member) => window.location.assign(chatHref(member.id))}
          />
        )}

        <section className={SECTION} aria-labelledby="h-password">
          <h2 id="h-password" className="section-title">
            Senha
          </h2>
          <form onSubmit={handlePassword} noValidate className="mt-3 space-y-3">
            {(
              [
                ["current", "Senha atual", "current-password"],
                ["next", "Nova senha", "new-password"],
                ["confirm", "Repita a nova senha", "new-password"],
              ] as const
            ).map(([key, label, autoComplete]) => (
              <div key={key}>
                <label htmlFor={`profile-password-${key}`} className="mb-1 block text-sm font-medium">
                  {label}
                </label>
                <input
                  id={`profile-password-${key}`}
                  type="password"
                  className={FIELD}
                  value={password[key]}
                  autoComplete={autoComplete}
                  aria-invalid={Boolean(passwordErrors[key])}
                  aria-describedby={passwordErrors[key] ? `profile-password-${key}-error` : undefined}
                  onChange={setPasswordField(key)}
                />
                {passwordErrors[key] && (
                  <p id={`profile-password-${key}-error`} role="alert" className="mt-1 text-sm text-prio-urgent">
                    {passwordErrors[key]}
                  </p>
                )}
              </div>
            ))}
            <p className="caption">Mínimo de {PASSWORD_MIN} caracteres.</p>
            <Button type="submit" variant="primary" disabled={busy === "password"}>
              {busy === "password" ? "Alterando…" : "Alterar senha"}
            </Button>
          </form>
        </section>

        <section className={SECTION} aria-labelledby="h-session">
          <h2 id="h-session" className="section-title">
            Sessão
          </h2>
          <p className="caption mt-1">Em computador compartilhado, saia ao terminar.</p>
          <Button className="mt-3" onClick={() => void signOut()}>
            <LogoutIcon />
            Sair
          </Button>
        </section>
      </main>

      <ConfirmDialog
        open={confirmRemove}
        title="Remover foto?"
        message="Sua inicial volta a aparecer no lugar da foto, nas tarefas e na barra."
        confirmLabel="Remover"
        onConfirm={() => void handleRemovePhoto()}
        onCancel={() => setConfirmRemove(false)}
      />
      <ToastViewport />
    </div>
  );
}
