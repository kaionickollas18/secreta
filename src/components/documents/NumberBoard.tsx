import type { DocumentKind } from "../../types/officialDocument";
import { formatDueDate } from "../../utils/date";
import { DOCUMENT_KIND_LABELS, type BoardCell, type BoardCellState } from "../../utils/officialDocuments";

/**
 * Cores do quadro, como o marca-texto na folha da secretaria: rosa no que já foi entregue,
 * azul no que foi feito e ainda aguarda entrega. O estado também vai escrito no nome do botão.
 */
const CELL_STYLES: Record<BoardCellState, string> = {
  free: "border-line text-muted hover:border-accent/60 hover:bg-raised/60 hover:text-ink",
  pending: "border-sky-300 bg-sky-300 text-slate-900 hover:brightness-110",
  delivered: "border-pink-300 bg-pink-300 text-slate-900 hover:brightness-110",
};

const STATE_TEXT: Record<BoardCellState, string> = {
  free: "livre",
  pending: "feito, aguardando entrega",
  delivered: "entregue",
};

interface NumberBoardProps {
  kind: DocumentKind;
  year: number;
  cells: BoardCell[];
  /** Número livre: registrar um documento com ele. Número usado: abrir o documento. */
  onPick: (cell: BoardCell) => void;
}

function describe(kind: DocumentKind, year: number, cell: BoardCell): string {
  const base = `${DOCUMENT_KIND_LABELS[kind]} ${cell.sequence} de ${year}: ${STATE_TEXT[cell.state]}`;
  if (!cell.document) return base;
  const when = cell.document.deliveredOn ? ` em ${formatDueDate(cell.document.deliveredOn)}` : "";
  return `${base}${when}. ${cell.document.subject}`;
}

/** Quadro de números: a sequência do ano em uma grade, pintada conforme o andamento. */
export function NumberBoard({ kind, year, cells, onPick }: NumberBoardProps) {
  return (
    <div className="glass w-full max-w-2xl rounded-2xl p-3 sm:p-4">
      <ul aria-label={`Números de ${DOCUMENT_KIND_LABELS[kind].toLowerCase()} de ${year}`} className="grid grid-cols-8 gap-1.5 sm:gap-2">
        {cells.map((cell) => (
          <li key={cell.sequence}>
            <button
              type="button"
              aria-label={describe(kind, year, cell)}
              title={cell.document ? `${cell.document.subject} · Para: ${cell.document.recipient}` : undefined}
              onClick={() => onPick(cell)}
              className={`flex aspect-square w-full min-h-[36px] items-center justify-center rounded-lg border text-sm font-bold tabular-nums transition-[background-color,border-color,filter] sm:text-lg ${CELL_STYLES[cell.state]}`}
            >
              {cell.sequence}
            </button>
          </li>
        ))}
      </ul>
      <ul aria-label="Legenda" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded border border-line" /> Livre (toque para registrar)
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded bg-sky-300" /> Feito, aguardando entrega
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded bg-pink-300" /> Entregue
        </li>
      </ul>
    </div>
  );
}
