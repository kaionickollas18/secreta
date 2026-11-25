import { useRef, useState } from "react";
import { useCardReader } from "../../hooks/useCardReader";
import { sheetsOf, useAssessmentStore } from "../../store/assessmentStore";
import { useToastStore } from "../../store/toastStore";
import type { AnswerSheet, Assessment, SheetSource } from "../../types/assessment";
import { assessmentProblems, formatPercent, scoreSheet } from "../../utils/assessments";
import { createId } from "../../utils/id";
import {
  manualPending,
  needsReview,
  pendingFromSheet,
  readyToSave,
  toAnswerSheet,
  type PendingSheet,
} from "../../utils/sheetReview";
import { Button, DELETE_BUTTON, IconButton } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { PencilIcon, TrashIcon } from "../ui/Icons";
import { Modal } from "../ui/Modal";
import { CameraCapture } from "./CameraCapture";
import { SheetReview } from "./SheetReview";

interface CorrectionPanelProps {
  assessment: Assessment;
}

const SOURCE_LABELS: Record<SheetSource, string> = {
  camera: "Câmera",
  image: "Foto",
  pdf: "PDF",
  manual: "Manual",
};

/** Correção: câmera, fotos/PDF ou lançamento manual → conferência → cartões salvos. */
export function CorrectionPanel({ assessment }: CorrectionPanelProps) {
  const allSheets = useAssessmentStore((s) => s.sheets);
  const saveSheet = useAssessmentStore((s) => s.saveSheet);
  const removeSheet = useAssessmentStore((s) => s.removeSheet);
  const pushToast = useToastStore((s) => s.push);
  const { progress, readFiles } = useCardReader(assessment);
  const fileInput = useRef<HTMLInputElement>(null);

  const [camera, setCamera] = useState(false);
  const [queue, setQueue] = useState<PendingSheet[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState<PendingSheet | null>(null);
  const [deleting, setDeleting] = useState<AnswerSheet | null>(null);

  const saved = sheetsOf(allSheets, assessment.id);
  const problems = assessmentProblems(assessment);
  const ready = queue.filter((p) => readyToSave(p, assessment));

  async function persist(pending: PendingSheet): Promise<string | null> {
    const sheet = toAnswerSheet(pending, assessment, new Date().toISOString());
    if (!sheet) return "Escolha o aluno deste cartão.";
    return saveSheet(sheet);
  }

  async function saveReviewed(pending: PendingSheet) {
    const error = await persist(pending);
    if (error) {
      pushToast({ tone: "error", message: error });
      return;
    }
    setQueue((q) => q.filter((p) => p.id !== pending.id));
    setReviewing(null);
    const student = assessment.roster.find((r) => r.slot === pending.slot);
    pushToast({ tone: "success", message: `Cartão de ${student?.name ?? "aluno"} salvo.` });
  }

  async function saveAllReady() {
    let count = 0;
    for (const pending of ready) {
      const error = await persist(pending);
      if (error) {
        pushToast({ tone: "error", message: error });
        break;
      }
      count += 1;
      setQueue((q) => q.filter((p) => p.id !== pending.id));
    }
    if (count) pushToast({ tone: "success", message: `${count} ${count === 1 ? "cartão salvo" : "cartões salvos"}.` });
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const outcome = await readFiles(Array.from(files));
    setQueue((q) => [...q, ...outcome.pending]);
    setFailures(outcome.failures);
    if (fileInput.current) fileInput.current.value = "";
    pushToast({
      tone: outcome.pending.length ? "success" : "error",
      message: outcome.pending.length
        ? `${outcome.pending.length} ${outcome.pending.length === 1 ? "cartão lido" : "cartões lidos"}. Confira e salve.`
        : "Nenhum cartão desta avaliação foi lido.",
    });
  }

  if (problems.length > 0) {
    return <EmptyState title="Complete o gabarito antes de corrigir" description={problems.join(" ")} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="correcao-fontes" className="glass flex flex-col gap-3 rounded-2xl p-4">
        <h2 id="correcao-fontes" className="section-title">
          Corrigir cartões
        </h2>
        <p className="caption">
          A leitura acontece neste aparelho: nenhuma imagem é enviada. Toda leitura passa pela conferência antes de entrar
          nos resultados; marcas duplas ou fracas ficam destacadas.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="primary" onClick={() => setCamera(true)}>
            Câmera do celular
          </Button>
          <Button variant="depth" onClick={() => fileInput.current?.click()} disabled={progress !== null}>
            Enviar fotos ou PDF
          </Button>
          <Button variant="secondary" onClick={() => setReviewing(manualPending(assessment, createId()))}>
            Lançar à mão
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Arquivos de cartões-resposta (PDF ou fotos)"
          onChange={(e) => void onFiles(e.target.files)}
        />
        {progress && (
          <div role="status" aria-live="polite" className="flex flex-col gap-1">
            <p className="text-sm">Lendo {progress.label}…</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-raised">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${Math.max(8, (progress.done / Math.max(1, progress.total)) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {failures.length > 0 && (
          <details className="rounded-xl bg-prio-medium-tint px-3 py-2 text-sm text-prio-medium">
            <summary className="cursor-pointer font-semibold">
              {failures.length} {failures.length === 1 ? "imagem não lida" : "imagens não lidas"}
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {failures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {queue.length > 0 && (
        <section aria-labelledby="correcao-fila" className="glass flex flex-col gap-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="correcao-fila" className="section-title">
              Para conferir ({queue.length})
            </h2>
            {ready.length > 0 && (
              <Button variant="primary" onClick={() => void saveAllReady()}>
                Salvar {ready.length} sem pendência
              </Button>
            )}
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {queue.map((pending) => {
              const student = assessment.roster.find((r) => r.slot === pending.slot);
              const review = needsReview(pending.flags).length;
              const duplicate = saved.some((s) => s.slot === pending.slot);
              return (
                <li key={pending.id} className="flex flex-wrap items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{student?.name ?? "Aluno não identificado"}</p>
                    <p className="caption truncate">
                      {pending.label} · {formatPercent(scoreSheet(assessment, pending).percent)}
                      {review ? ` · ${review} para conferir` : ""}
                      {duplicate ? " · substitui o cartão salvo" : ""}
                    </p>
                  </div>
                  <Button variant={review || !student ? "depth" : "secondary"} onClick={() => setReviewing(pending)}>
                    Conferir
                  </Button>
                  <IconButton
                    aria-label={`Descartar a leitura ${pending.label}`}
                    className={DELETE_BUTTON}
                    onClick={() => setQueue((q) => q.filter((p) => p.id !== pending.id))}
                  >
                    <TrashIcon />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="correcao-salvos" className="glass flex flex-col gap-3 rounded-2xl p-4">
        <h2 id="correcao-salvos" className="section-title">
          Corrigidos ({saved.length} de {assessment.roster.length})
        </h2>
        {saved.length === 0 ? (
          <p className="caption">Nenhum cartão salvo ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {[...saved]
              .sort((a, b) => a.slot - b.slot)
              .map((sheet) => {
                const score = scoreSheet(assessment, sheet);
                return (
                  <li key={sheet.id} className="flex items-center gap-3 py-2">
                    <span className="w-7 shrink-0 text-right text-sm tabular-nums text-muted">{sheet.slot}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{sheet.studentName}</p>
                      <p className="caption">
                        {score.correct}/{score.scored} · {SOURCE_LABELS[sheet.source]}
                        {sheet.edited ? " · ajustado à mão" : ""}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold tabular-nums ${score.percent < assessment.criticalThreshold ? "text-prio-urgent" : ""}`}
                    >
                      {formatPercent(score.percent)}
                    </span>
                    <IconButton aria-label={`Rever o cartão de ${sheet.studentName}`} onClick={() => setReviewing(pendingFromSheet(sheet))}>
                      <PencilIcon />
                    </IconButton>
                    <IconButton
                      aria-label={`Excluir o cartão de ${sheet.studentName}`}
                      className={DELETE_BUTTON}
                      onClick={() => setDeleting(sheet)}
                    >
                      <TrashIcon />
                    </IconButton>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <Modal open={reviewing !== null} title="Conferir cartão" onClose={() => setReviewing(null)} size="wide">
        {reviewing && (
          <SheetReview
            assessment={assessment}
            pending={reviewing}
            saved={saved}
            onChange={(next) => {
              setReviewing(next);
              setQueue((q) => q.map((p) => (p.id === next.id ? next : p)));
            }}
            onSave={() => void saveReviewed(reviewing)}
            onDiscard={() => setReviewing(null)}
            discardLabel="Fechar"
          />
        )}
      </Modal>

      {camera && (
        <CameraCapture assessment={assessment} saved={saved} onSave={persist} onClose={() => setCamera(false)} />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir cartão corrigido?"
        message={deleting ? `O cartão de ${deleting.studentName} sai dos resultados. Dá para corrigir de novo depois.` : ""}
        confirmLabel="Excluir"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const sheet = deleting;
          setDeleting(null);
          if (sheet)
            void removeSheet(sheet.id).then((error) => {
              if (error) pushToast({ tone: "error", message: error });
            });
        }}
      />
    </div>
  );
}
