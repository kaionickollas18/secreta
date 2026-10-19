import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useSchoolStore } from "../../store/schoolStore";
import { useToastStore } from "../../store/toastStore";
import type { SchoolIdentityErrors, SchoolIdentityForm } from "../../types/school";
import { formatCep, IDENTITY_LIMITS, prepareLogo, validateIdentity, validateLogoFile } from "../../utils/schoolIdentity";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";
const LABEL = "mb-1 block text-sm font-medium";

interface SchoolIdentityModalProps {
  open: boolean;
  schoolId: string;
  onClose: () => void;
}

/** Dados oficiais e logo da escola: aparecem no cabeçalho e no fundo dos documentos em PDF. */
export function SchoolIdentityModal({ open, schoolId, onClose }: SchoolIdentityModalProps) {
  const { identity, save, saveLogo, removeLogo } = useSchoolStore();
  const pushToast = useToastStore((s) => s.push);
  const [form, setForm] = useState<SchoolIdentityForm>(identity);
  const [errors, setErrors] = useState<SchoolIdentityErrors>({});
  const [logoError, setLogoError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"form" | "logo" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Ao abrir, o formulário começa com o que está salvo.
  useEffect(() => {
    if (!open) return;
    const { officialName, inep, address, cep, decree } = useSchoolStore.getState().identity;
    setForm({ officialName, inep, address, cep: formatCep(cep), decree });
    setErrors({});
    setLogoError(null);
  }, [open]);

  const field = (key: keyof SchoolIdentityForm) => ({
    id: `school-${key}`,
    className: FIELD,
    value: form[key],
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `school-${key}-error` : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  const errorOf = (key: keyof SchoolIdentityForm) =>
    errors[key] && (
      <p id={`school-${key}-error`} role="alert" className="mt-1 text-sm text-prio-urgent">
        {errors[key]}
      </p>
    );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateIdentity(form);
    setErrors(result.valid ? {} : result.errors);
    if (!result.valid) return;
    setBusy("form");
    const error = await save(schoolId, result.value);
    setBusy(null);
    pushToast(error ? { tone: "error", message: error } : { tone: "success", message: "Dados da escola salvos." });
    if (!error) onClose();
  }

  async function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    const problem = validateLogoFile(file);
    setLogoError(problem);
    if (problem) return;
    setBusy("logo");
    try {
      const error = await saveLogo(schoolId, await prepareLogo(file));
      pushToast(error ? { tone: "error", message: error } : { tone: "success", message: "Logo atualizada." });
    } catch {
      setLogoError("Não foi possível ler essa imagem. Tente outro arquivo.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveLogo() {
    setBusy("logo");
    const error = await removeLogo(schoolId);
    setBusy(null);
    pushToast(error ? { tone: "error", message: error } : { tone: "success", message: "Logo removida." });
  }

  return (
    <Modal open={open} title="Dados da escola" onClose={onClose}>
      <p className="caption mb-4">Aparecem no cabeçalho dos documentos em PDF. A logo vai também ao fundo, bem clara.</p>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-1">
          {identity.logoUrl ? (
            <img src={identity.logoUrl} alt="Logo atual da escola" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-center text-2xs text-slate-500">Sem logo</span>
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-label="Arquivo da logo da escola"
            onChange={(event) => void handleLogo(event)}
          />
          <Button disabled={busy === "logo"} onClick={() => fileInput.current?.click()}>
            {busy === "logo" ? "Enviando…" : identity.logoUrl ? "Trocar logo" : "Enviar logo"}
          </Button>
          {identity.logoUrl && (
            <Button variant="ghost" disabled={busy === "logo"} onClick={() => void handleRemoveLogo()}>
              Remover
            </Button>
          )}
        </div>
        {logoError ? (
          <p role="alert" className="w-full text-sm text-prio-urgent">
            {logoError}
          </p>
        ) : (
          <p className="caption w-full">PNG, JPG ou WebP. PNG com fundo transparente fica melhor.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="school-officialName" className={LABEL}>
            Nome oficial *
          </label>
          <input {...field("officialName")} data-autofocus maxLength={IDENTITY_LIMITS.officialName} />
          {errorOf("officialName")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="school-inep" className={LABEL}>
              INEP
            </label>
            <input {...field("inep")} inputMode="numeric" maxLength={12} placeholder="8 dígitos" />
            {errorOf("inep")}
          </div>
          <div>
            <label htmlFor="school-cep" className={LABEL}>
              CEP
            </label>
            <input {...field("cep")} inputMode="numeric" maxLength={12} placeholder="00.000-000" />
            {errorOf("cep")}
          </div>
        </div>
        <div>
          <label htmlFor="school-address" className={LABEL}>
            Endereço
          </label>
          <input {...field("address")} maxLength={IDENTITY_LIMITS.address} placeholder="Rua, número e bairro" />
          {errorOf("address")}
        </div>
        <div>
          <label htmlFor="school-decree" className={LABEL}>
            Ato de criação (decreto ou lei)
          </label>
          <input {...field("decree")} maxLength={IDENTITY_LIMITS.decree} />
          {errorOf("decree")}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={busy === "form"}>
            {busy === "form" ? "Salvando…" : "Salvar dados"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
