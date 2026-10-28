import { useEffect, useState } from "react";
import { formatFileSize, isImageType } from "../../utils/chatFiles";
import { Button } from "../ui/Button";
import { DownloadIcon, FileIcon, ImageIcon } from "../ui/Icons";

interface AttachmentCardProps {
  file: { name: string; type: string; size: number };
  /** Baixa e abre o arquivo protegido. */
  onOpen: () => Promise<{ blob: Blob; error: null } | { blob: null; error: string }>;
}

/** Salva o arquivo aberto no aparelho, com o nome original. */
function saveBlob(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Anexo de uma mensagem direta: nome, tipo e tamanho, e os botões para ver (imagens) e baixar.
 * O arquivo só é buscado e aberto quando a pessoa pede, e uma vez só.
 */
export function AttachmentCard({ file, onOpen }: AttachmentCardProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const image = isImageType(file.type);

  // O endereço local do arquivo aberto vale até a mensagem sair da tela.
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  async function ensureUrl(): Promise<string | null> {
    if (url) return url;
    setBusy(true);
    setError(null);
    const result = await onOpen();
    setBusy(false);
    if (result.error !== null) {
      setError(result.error);
      return null;
    }
    const created = URL.createObjectURL(result.blob);
    setUrl(created);
    return created;
  }

  async function download() {
    const ready = await ensureUrl();
    if (ready) saveBlob(ready, file.name);
  }

  async function preview() {
    if (showPreview) {
      setShowPreview(false);
      return;
    }
    if (await ensureUrl()) setShowPreview(true);
  }

  return (
    <div className="mt-1.5 space-y-2">
      {showPreview && url && (
        <img src={url} alt={`Imagem anexada: ${file.name}`} className="max-h-80 w-full rounded-xl bg-raised object-contain" />
      )}
      <div className="flex items-center gap-3 rounded-xl bg-surface/70 p-2 ring-1 ring-line">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-light"
        >
          {image ? <ImageIcon /> : <FileIcon />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" title={file.name}>
            {file.name}
          </span>
          <span className="block text-xs text-muted">
            {image ? "Imagem" : "PDF"} · {formatFileSize(file.size)}
          </span>
        </span>
        {image && (
          <Button variant="ghost" className="!min-h-[36px] !px-3" disabled={busy} onClick={() => void preview()}>
            {showPreview ? "Ocultar" : "Ver"}
          </Button>
        )}
        <Button
          variant="depth"
          className="!min-h-[36px] !px-3"
          disabled={busy}
          aria-label={`Baixar ${file.name}`}
          onClick={() => void download()}
        >
          <DownloadIcon />
          {busy ? "Abrindo…" : "Baixar"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-prio-urgent">
          {error}
        </p>
      )}
    </div>
  );
}
