import { useEffect, useMemo, useState } from "react";
import { DeliveryForm } from "../components/documents/DeliveryForm";
import { DocumentCard } from "../components/documents/DocumentCard";
import { DocumentForm } from "../components/documents/DocumentForm";
import { NumberBoard } from "../components/documents/NumberBoard";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { PlusIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { ToastViewport } from "../components/ui/ToastViewport";
import { useAuthStore } from "../store/authStore";
import { useDocumentStore } from "../store/documentStore";
import { useToastStore } from "../store/toastStore";
import {
  DOCUMENT_KINDS,
  type DocumentFilter,
  type DocumentKind,
  type OfficialDocument,
} from "../types/officialDocument";
import { todayISO } from "../utils/date";
import {
  boardYears,
  countPending,
  DOCUMENT_KIND_LABELS,
  DOCUMENT_VIEW_KEY,
  documentTitle,
  filterDocuments,
  formatDocumentNumber,
  numberBoard,
  parseDocumentView,
  sortDocuments,
  type BoardCell,
  type DocumentView,
} from "../utils/officialDocuments";
import { canDeleteDocuments, effectiveRole } from "../utils/roles";

type ModalState =
  | { mode: "create"; preset?: { kind: DocumentKind; number: string } }
  | { mode: "edit"; document: OfficialDocument }
  | { mode: "deliver"; document: OfficialDocument }
  /** Documento aberto pelo quadro de números (já entregue): mostra os dados e as ações. */
  | { mode: "view"; id: string }
  | null;

const FILTERS: { id: DocumentFilter; label: string }[] = [
  { id: "pending", label: "Aguardando entrega" },
  { id: "delivered", label: "Entregues" },
  { id: "all", label: "Todos" },
];

const VIEWS: { id: DocumentView; label: string }[] = [
  { id: "board", label: "Quadro de números" },
  { id: "list", label: "Lista" },
];

const KIND_PLURALS: Record<DocumentKind, string> = { memo: "Memorandos", oficio: "Ofícios" };

/** Botão de escolha (visão, tipo, filtro): destacado quando é o selecionado. */
const CHOICE =
  "inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors";
const choice = (selected: boolean) =>
  `${CHOICE} ${selected ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:bg-raised/60 hover:text-ink"}`;

function readView(): DocumentView {
  try {
    return parseDocumentView(window.localStorage.getItem(DOCUMENT_VIEW_KEY));
  } catch {
    return "board";
  }
}

/**
 * Acompanhamento de memorandos e ofícios. Duas visões: o quadro de números (a sequência do
 * ano, pintada conforme cada documento é feito e entregue) e a lista com os detalhes.
 */
export default function DocumentosApp() {
  const profile = useAuthStore((s) => s.profile);
  const { documents, status, load, save, deliver, undoDelivery, remove } = useDocumentStore();
  const pushToast = useToastStore((s) => s.push);
  const [view, setView] = useState<DocumentView>(readView);
  const [kind, setKind] = useState<DocumentKind>("memo");
  const [year, setYear] = useState(() => Number(todayISO().slice(0, 4)));
  const [filter, setFilter] = useState<DocumentFilter>("pending");
  const [modal, setModal] = useState<ModalState>(null);
  const [toDelete, setToDelete] = useState<OfficialDocument | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => sortDocuments(filterDocuments(documents, filter)), [documents, filter]);
  const cells = useMemo(() => numberBoard(documents, kind, year), [documents, kind, year]);
  const years = useMemo(() => boardYears(documents, Number(todayISO().slice(0, 4))), [documents]);
  const pending = countPending(documents);
  const counts: Record<DocumentFilter, number> = {
    pending,
    delivered: documents.length - pending,
    all: documents.length,
  };

  if (!profile?.schoolId) return null;
  const schoolId = profile.schoolId;
  const canDelete = canDeleteDocuments(effectiveRole(profile));
  const viewed = modal?.mode === "view" ? documents.find((d) => d.id === modal.id) : undefined;

  function report(error: string | null, success: string) {
    pushToast(error ? { tone: "error", message: error } : { tone: "success", message: success });
  }

  function chooseView(next: DocumentView) {
    setView(next);
    try {
      window.localStorage.setItem(DOCUMENT_VIEW_KEY, next);
    } catch {
      // sem armazenamento local: a escolha vale só até recarregar
    }
  }

  /** No quadro: número livre abre o registro; aguardando abre a entrega; entregue, os dados. */
  function pickCell(cell: BoardCell) {
    if (!cell.document) {
      setModal({ mode: "create", preset: { kind, number: formatDocumentNumber(cell.sequence, year) } });
    } else if (cell.state === "pending") {
      setModal({ mode: "deliver", document: cell.document });
    } else {
      setModal({ mode: "view", id: cell.document.id });
    }
  }

  function undo(document: OfficialDocument) {
    void undoDelivery(document.id).then((error) => report(error, "Entrega desfeita."));
  }

  async function handleDelete() {
    if (!toDelete) return;
    const error = await remove(toDelete.id);
    setToDelete(null);
    setModal(null);
    report(error, "Documento excluído.");
  }

  const cardActions = {
    canDelete,
    onDeliver: (d: OfficialDocument) => setModal({ mode: "deliver", document: d }),
    onUndo: undo,
    onEdit: (d: OfficialDocument) => setModal({ mode: "edit", document: d }),
    onDelete: setToDelete,
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Documentos</h1>
          <p className="page-lede">
            {pending > 0
              ? `${pending} ${pending === 1 ? "documento aguarda" : "documentos aguardam"} entrega.`
              : "Memorandos e ofícios da secretaria, com o que já foi entregue."}
          </p>
        </div>
        <Button variant="primary" onClick={() => setModal({ mode: "create" })}>
          <PlusIcon />
          Novo documento
        </Button>
      </header>

      <div role="group" aria-label="Como ver os documentos" className="flex flex-wrap gap-2">
        {VIEWS.map(({ id, label }) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => chooseView(id)} className={choice(view === id)}>
            {label}
          </button>
        ))}
      </div>

      {status === "loading" && (
        <>
          <p role="status" className="sr-only">
            Carregando documentos…
          </p>
          <Skeleton className="h-64 rounded-2xl" />
        </>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-prio-urgent">
          Não foi possível carregar os documentos.{" "}
          <button className="underline" onClick={() => void load()}>
            Tentar de novo
          </button>
        </p>
      )}

      {status === "ready" && view === "board" && (
        <main className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Tipo de documento" className="flex flex-wrap gap-2">
              {DOCUMENT_KINDS.map((id) => (
                <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={choice(kind === id)}>
                  {KIND_PLURALS[id]}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-sm text-muted">
              Ano
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="glass min-h-[40px] rounded-full px-3 text-sm text-ink"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <NumberBoard kind={kind} year={year} cells={cells} onPick={pickCell} />
          <p className="caption">
            O quadro lê o número do começo do campo “Número” (ex.: 073/{year}). {DOCUMENT_KIND_LABELS[kind]} sem número
            no começo aparece só na lista.
          </p>
        </main>
      )}

      {status === "ready" && view === "list" && (
        <main className="flex flex-1 flex-col gap-4">
          <div role="group" aria-label="Filtrar documentos" className="flex flex-wrap gap-2">
            {FILTERS.map(({ id, label }) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={choice(filter === id)}>
                {label}
                <span className="tabular-nums text-muted">{counts[id]}</span>
              </button>
            ))}
          </div>
          {visible.length === 0 && (
            <EmptyState
              title={
                documents.length === 0
                  ? "Nenhum documento registrado"
                  : filter === "pending"
                    ? "Nada aguardando entrega"
                    : "Nenhum documento entregue ainda"
              }
              description={
                documents.length === 0
                  ? "Registre os memorandos e ofícios que a secretaria emite e marque quando forem entregues."
                  : "Troque o filtro acima para ver os outros documentos."
              }
            />
          )}
          <ul className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((document) => (
              <DocumentCard key={document.id} document={document} {...cardActions} />
            ))}
          </ul>
        </main>
      )}

      <Modal
        open={modal !== null && (modal.mode !== "view" || viewed !== undefined)}
        title={
          modal?.mode === "deliver"
            ? "Marcar entrega"
            : modal?.mode === "edit"
              ? "Editar documento"
              : viewed
                ? documentTitle(viewed)
                : "Novo documento"
        }
        onClose={() => setModal(null)}
      >
        {viewed && (
          <ul>
            <DocumentCard document={viewed} {...cardActions} />
          </ul>
        )}
        {modal?.mode === "deliver" && (
          <DeliveryForm
            key={modal.document.id}
            document={modal.document}
            onCancel={() => setModal(null)}
            onSubmit={async (delivery) => {
              const error = await deliver(modal.document.id, delivery);
              if (!error) {
                setModal(null);
                pushToast({ tone: "success", message: `${documentTitle(modal.document)} marcado como entregue.` });
              }
              return error;
            }}
          />
        )}
        {modal && (modal.mode === "create" || modal.mode === "edit") && (
          <DocumentForm
            key={modal.mode === "edit" ? modal.document.id : (modal.preset?.number ?? "new")}
            document={modal.mode === "edit" ? modal.document : undefined}
            preset={modal.mode === "create" ? modal.preset : undefined}
            onCancel={() => setModal(null)}
            onSubmit={async (input) => {
              const editing = modal.mode === "edit";
              const error = await save(schoolId, input, editing ? modal.document.id : undefined);
              if (!error) {
                setModal(null);
                pushToast({ tone: "success", message: editing ? "Documento atualizado." : "Documento registrado." });
              }
              return error;
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir documento?"
        message={toDelete ? `O registro de “${documentTitle(toDelete)}” será apagado para toda a escola.` : ""}
        confirmLabel="Excluir"
        onConfirm={() => void handleDelete()}
        onCancel={() => setToDelete(null)}
      />
      <ToastViewport />
    </div>
  );
}
