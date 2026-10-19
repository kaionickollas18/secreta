import type { OfficialDocument } from "../../types/officialDocument";
import { formatDueDate } from "../../utils/date";
import { documentTitle, isDelivered } from "../../utils/officialDocuments";
import { Button, DELETE_BUTTON, EDIT_BUTTON, IconButton } from "../ui/Button";
import { CheckIcon, PencilIcon, TrashIcon } from "../ui/Icons";

interface DocumentCardProps {
  document: OfficialDocument;
  /** Só o Secretário exclui. */
  canDelete: boolean;
  onDeliver: (document: OfficialDocument) => void;
  onUndo: (document: OfficialDocument) => void;
  onEdit: (document: OfficialDocument) => void;
  onDelete: (document: OfficialDocument) => void;
}

export function DocumentCard({ document, canDelete, onDeliver, onUndo, onEdit, onDelete }: DocumentCardProps) {
  const delivered = isDelivered(document);
  const title = documentTitle(document);

  return (
    <li className={`glass flex flex-col gap-3 rounded-2xl p-4 ${delivered ? "border-prio-low/30" : "border-prio-medium/55"}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="break-words section-title">{title}</h3>
          <p className="mt-0.5 caption">
            {formatDueDate(document.issuedOn)} · Para: {document.recipient}
          </p>
        </div>
        <div className="flex shrink-0">
          <IconButton aria-label={`Editar ${title}`} className={EDIT_BUTTON} onClick={() => onEdit(document)}>
            <PencilIcon />
          </IconButton>
          {canDelete && (
            <IconButton aria-label={`Excluir ${title}`} className={DELETE_BUTTON} onClick={() => onDelete(document)}>
              <TrashIcon />
            </IconButton>
          )}
        </div>
      </div>

      <p className="break-words text-sm font-medium">{document.subject}</p>

      {document.summary && (
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted">Resumo</p>
          <p className="mt-0.5 whitespace-pre-line break-words text-sm text-muted">{document.summary}</p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            delivered ? "bg-prio-low-tint text-prio-low" : "bg-prio-medium-tint text-prio-medium"
          }`}
        >
          {document.deliveredOn ? `Entregue em ${formatDueDate(document.deliveredOn)}` : "Aguardando entrega"}
        </span>
        {document.receivedBy && <span className="text-xs text-muted">Recebido por {document.receivedBy}</span>}
      </div>

      <div>
        {delivered ? (
          <Button variant="ghost" aria-label={`Desfazer a entrega de ${title}`} onClick={() => onUndo(document)}>
            Desfazer entrega
          </Button>
        ) : (
          <Button variant="primary" aria-label={`Marcar ${title} como entregue`} onClick={() => onDeliver(document)}>
            <CheckIcon />
            Marcar como entregue
          </Button>
        )}
      </div>
    </li>
  );
}
