import { useId, useState, type ChangeEvent } from "react";
import { readPdfText } from "../../utils/pdfReader";
import type { TextItem } from "../../utils/pdfText";

interface PdfPickerProps {
  label: string;
  disabled?: boolean;
  /** Texto do PDF lido; o nome do arquivo vai junto. */
  onRead: (items: TextItem[], fileName: string) => void;
}

/** Escolhe um PDF e lê o texto dele no navegador, mostrando o andamento. */
export function PdfPicker({ label, disabled = false, onRead }: PdfPickerProps) {
  const inputId = useId();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setProgress("Abrindo o arquivo…");
    try {
      const items = await readPdfText(file, (page, pages) => setProgress(`Lendo a página ${page} de ${pages}…`));
      setProgress(null);
      onRead(items, file.name);
    } catch (cause) {
      setProgress(null);
      setError(cause instanceof Error ? cause.message : "Não foi possível ler o arquivo.");
    }
  }

  const busy = progress !== null;
  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept=".pdf,application/pdf"
        disabled={disabled || busy}
        onChange={(event) => void handleChange(event)}
        className="block w-full text-sm text-muted file:mr-3 file:min-h-[40px] file:cursor-pointer file:rounded-full file:border-0 file:bg-raised file:px-4 file:text-sm file:font-semibold file:text-ink"
      />
      {busy && (
        <p role="status" className="mt-2 text-sm text-muted">
          {progress}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-prio-urgent">
          {error}
        </p>
      )}
    </div>
  );
}
