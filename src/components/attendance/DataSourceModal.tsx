import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useAttendanceStore } from "../../store/attendanceStore";
import { useToastStore } from "../../store/toastStore";
import type { DataSource } from "../../types/attendance";
import {
  parseCsvFiles,
  validateSheetForm,
  type SheetForm,
} from "../../utils/attendanceSource";
import { formatDateTime } from "../../utils/history";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Modal } from "../ui/Modal";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";
const SECTION = "rounded-2xl border border-line bg-canvas/40 p-4";

const SOURCE_LABELS: Record<DataSource, string> = {
  sheet: "Planilha online",
  file: "Base offline (arquivos)",
};

interface DataSourceModalProps {
  open: boolean;
  schoolId: string;
  onClose: () => void;
}

/** Área do Secretário: define de onde o dashboard lê a frequência (link ou arquivos CSV). */
export function DataSourceModal({ open, schoolId, onClose }: DataSourceModalProps) {
  const {
    settings,
    offline,
    loadOffline,
    saveSheet,
    setSource,
    addOfflineClasses,
    removeOfflineClass,
    clearOffline,
  } = useAttendanceStore();
  const pushToast = useToastStore((s) => s.push);
  const [form, setForm] = useState<SheetForm>({ sheetUrl: "", classNames: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof SheetForm, string>>>({});
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Ao abrir, o formulário reflete a configuração salva.
  useEffect(() => {
    if (!open) return;
    setForm({ sheetUrl: settings.sheetUrl, classNames: settings.classNames.join("\n") });
    setErrors({});
    setFileErrors([]);
    void loadOffline(schoolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir; não sobrescrever o que o usuário digita
  }, [open]);

  /** Roda a ação com o aviso de sucesso ou erro. */
  async function run(action: () => Promise<string | null>, success: string) {
    setBusy(true);
    const error = await action();
    setBusy(false);
    pushToast(
      error ? { tone: "error", message: error } : { tone: "success", message: success },
    );
    return !error;
  }

  async function handleSaveSheet(event: FormEvent) {
    event.preventDefault();
    const result = validateSheetForm(form);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await run(
      () => saveSheet(schoolId, result.value.sheetUrl, result.value.classNames),
      "Planilha salva. O dashboard passa a usar o link.",
    );
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;
    const files = await Promise.all(
      picked.map(async (file) => ({
        name: file.name,
        size: file.size,
        text: await file.text(),
      })),
    );
    const { classes, errors: problems } = parseCsvFiles(files);
    setFileErrors(problems);
    if (classes.length > 0) {
      await run(
        () => addOfflineClasses(schoolId, classes),
        `${classes.length} ${classes.length === 1 ? "turma enviada" : "turmas enviadas"} para a base offline.`,
      );
    }
    // Permite escolher o mesmo arquivo de novo.
    if (fileInput.current) fileInput.current.value = "";
  }

  const offlineClasses = offline?.classes ?? [];

  return (
    <>
      <Modal open={open} title="Base de dados do dashboard" onClose={onClose}>
        <p className="text-sm text-muted">
          Fonte em uso:{" "}
          <strong className="text-ink">
            {settings.source ? SOURCE_LABELS[settings.source] : "nenhuma"}
          </strong>
        </p>

        <form
          onSubmit={handleSaveSheet}
          noValidate
          className={`mt-4 space-y-3 ${SECTION}`}
        >
          <h3 className="text-sm font-semibold">Planilha online (Google Sheets)</h3>
          <div>
            <label htmlFor="source-url" className="mb-1 block text-sm font-medium">
              Link da planilha
            </label>
            <input
              id="source-url"
              type="url"
              data-autofocus
              className={FIELD}
              value={form.sheetUrl}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              aria-invalid={Boolean(errors.sheetUrl)}
              aria-describedby={errors.sheetUrl ? "source-url-error" : "source-url-hint"}
              onChange={(e) => setForm((f) => ({ ...f, sheetUrl: e.target.value }))}
            />
            {errors.sheetUrl ? (
              <p
                id="source-url-error"
                role="alert"
                className="mt-1 text-sm text-prio-urgent"
              >
                {errors.sheetUrl}
              </p>
            ) : (
              <p id="source-url-hint" className="mt-1 text-xs text-muted">
                A planilha precisa estar compartilhada como “qualquer pessoa com o link
                pode ver”. Atenção: quem tiver o link consegue ver os nomes dos alunos.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="source-classes" className="mb-1 block text-sm font-medium">
              Abas da planilha (uma turma por linha)
            </label>
            <textarea
              id="source-classes"
              rows={5}
              className={FIELD}
              value={form.classNames}
              placeholder={"5 ano A\n5 ano B\n6 ano A"}
              aria-invalid={Boolean(errors.classNames)}
              aria-describedby={
                errors.classNames ? "source-classes-error" : "source-classes-hint"
              }
              onChange={(e) => setForm((f) => ({ ...f, classNames: e.target.value }))}
            />
            {errors.classNames ? (
              <p
                id="source-classes-error"
                role="alert"
                className="mt-1 text-sm text-prio-urgent"
              >
                {errors.classNames}
              </p>
            ) : (
              <p id="source-classes-hint" className="mt-1 text-xs text-muted">
                Escreva o nome exatamente como aparece na aba. Um nome errado pode trazer
                os dados de outra aba.
              </p>
            )}
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            {settings.source === "sheet" ? "Salvar planilha" : "Salvar e usar a planilha"}
          </Button>
        </form>

        <section aria-labelledby="h-offline" className={`mt-4 space-y-3 ${SECTION}`}>
          <h3 id="h-offline" className="text-sm font-semibold">
            Base offline (arquivos CSV)
          </h3>
          <p className="text-xs text-muted">
            Envie um arquivo .csv por turma. O nome do arquivo vira o nome da turma (ex.:
            “5 ano A.csv”). Enviar de novo uma turma substitui a anterior. Com a planilha
            online em uso, esta base serve de reserva se o link falhar.
          </p>
          <div>
            <label htmlFor="source-files" className="mb-1 block text-sm font-medium">
              Enviar arquivos
            </label>
            <input
              id="source-files"
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              multiple
              disabled={busy}
              onChange={(e) => void handleFiles(e)}
              className="block w-full text-sm text-muted file:mr-3 file:min-h-[40px] file:cursor-pointer file:rounded-md file:border file:border-line file:bg-raised file:px-3 file:text-sm file:font-semibold file:text-ink"
            />
          </div>
          {fileErrors.length > 0 && (
            <ul role="alert" className="space-y-1 text-sm text-prio-urgent">
              {fileErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          {settings.hasFile ? (
            <>
              <p className="text-xs text-muted">
                {offlineClasses.length} {offlineClasses.length === 1 ? "turma" : "turmas"}{" "}
                na base
                {settings.fileUpdatedAt
                  ? ` · atualizada em ${formatDateTime(settings.fileUpdatedAt)}`
                  : ""}
              </p>
              <ul className="space-y-1">
                {offlineClasses.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-1.5 text-sm"
                  >
                    <span className="min-w-0 break-words">
                      {item.name}{" "}
                      <span className="text-xs text-muted">
                        · {item.records.length} dias
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      className="!min-h-[32px] shrink-0 px-2 text-xs"
                      disabled={busy}
                      aria-label={`Remover a turma ${item.name} da base offline`}
                      onClick={() =>
                        void run(
                          () => removeOfflineClass(schoolId, item.name),
                          `Turma ${item.name} removida.`,
                        )
                      }
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {settings.source !== "file" && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => setSource(schoolId, "file"),
                        "O dashboard passa a usar a base offline.",
                      )
                    }
                  >
                    Usar a base offline
                  </Button>
                )}
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => setConfirmClear(true)}
                >
                  Apagar base offline
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm italic text-muted">Nenhum arquivo enviado ainda.</p>
          )}
        </section>

        <div className="mt-4 flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmClear}
        title="Apagar base offline?"
        message="Todas as turmas enviadas serão apagadas. Os arquivos originais no seu computador não são afetados."
        confirmLabel="Apagar"
        onConfirm={() => {
          setConfirmClear(false);
          void run(() => clearOffline(schoolId), "Base offline apagada.");
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}
