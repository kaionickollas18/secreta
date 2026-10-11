import { useEffect } from "react";
import { PRIORITY_LABELS } from "../../constants/board";
import { useHistoryStore } from "../../store/historyStore";
import {
  formatDateTime,
  HISTORY_PERIODS,
  historyFileName,
  historyToCsv,
  periodLabel,
  type HistoryPeriod,
} from "../../utils/history";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
}

function downloadCsv(content: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Histórico permanente das tarefas concluídas, com filtro de período e download em CSV. */
export function HistoryModal({ open, onClose }: HistoryModalProps) {
  const { entries, period, status, load } = useHistoryStore();

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Modal open={open} title="Histórico de tarefas concluídas" onClose={onClose}>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Período do histórico"
          data-autofocus
          value={period}
          onChange={(e) => {
            const next = Number(e.target.value);
            const match = HISTORY_PERIODS.find((p) => p === next);
            if (match !== undefined) void load(match as HistoryPeriod);
          }}
          className="glass min-h-[40px] rounded-full px-3 text-sm"
        >
          {HISTORY_PERIODS.map((p) => (
            <option key={p} value={p}>
              {periodLabel(p)}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          disabled={status !== "ready" || entries.length === 0}
          onClick={() => downloadCsv(historyToCsv(entries), historyFileName(period))}
        >
          Baixar planilha (CSV)
        </Button>
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-sm text-muted">
        {status === "loading" && "Carregando…"}
        {status === "ready" &&
          (entries.length === 0
            ? "Nenhuma tarefa concluída neste período."
            : `${entries.length} ${entries.length === 1 ? "tarefa concluída" : "tarefas concluídas"}.`)}
      </p>
      {status === "error" && (
        <p role="alert" className="mt-3 text-sm text-prio-urgent">
          Não foi possível carregar o histórico.{" "}
          <button className="underline" onClick={() => void load()}>
            Tentar de novo
          </button>
        </p>
      )}

      {status === "ready" && entries.length > 0 && (
        <ul className="mt-3 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-line bg-canvas/50 p-3">
              <p className="break-words text-sm font-semibold">{entry.title}</p>
              <p className="mt-1 text-xs text-muted">
                Concluída em {formatDateTime(entry.completedAt)}
                {entry.completedByName ? ` por ${entry.completedByName}` : ""} · Prioridade{" "}
                {PRIORITY_LABELS[entry.priority].toLowerCase()}
              </p>
              <p className="text-xs text-muted">
                Responsáveis:{" "}
                {entry.assigneeNames.length > 0 ? entry.assigneeNames.join(", ") : "sem responsável"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
