import { useEffect, useState } from "react";
import type { StudentReport } from "../../types/attendance";
import { absenceMonths, absenceMonthsText, absencesText, defaultBuscaMonths } from "../../utils/students";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface BuscaAtivaMonthsModalProps {
  open: boolean;
  report: StudentReport;
  onClose: () => void;
  /** Meses escolhidos (YYYY-MM), em ordem. */
  onConfirm: (months: string[]) => void;
}

/** Antes de gerar a busca ativa: escolher de quais meses as faltas entram no documento. */
export function BuscaAtivaMonthsModal({ open, report, onClose, onConfirm }: BuscaAtivaMonthsModalProps) {
  const options = absenceMonths(report);
  const [chosen, setChosen] = useState<string[]>([]);

  // Cada vez que abre, começa com o mês mais recente com falta.
  useEffect(() => {
    if (open) setChosen(defaultBuscaMonths(report));
  }, [open, report]);

  const picked = options.filter((month) => chosen.includes(month.month));
  const total = picked.reduce((sum, month) => sum + month.absences, 0);

  function toggle(month: string, checked: boolean) {
    setChosen((current) => (checked ? [...current, month] : current.filter((m) => m !== month)));
  }

  return (
    <Modal open={open} title="Busca ativa" onClose={onClose}>
      <fieldset>
        <legend className="mb-3 text-sm text-muted">
          Escolha os meses cujas faltas vão aparecer no documento de {report.name}.
        </legend>
        {options.length === 0 ? (
          <p className="text-sm">Este aluno não tem faltas registradas.</p>
        ) : (
          <ul className="space-y-2">
            {options.map((month, index) => (
              <li key={month.month}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border border-line bg-canvas/40 px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={chosen.includes(month.month)}
                    onChange={(event) => toggle(month.month, event.target.checked)}
                    data-autofocus={index === options.length - 1 ? true : undefined}
                  />
                  <span className="flex-1 text-sm font-medium">{month.label}</span>
                  <span className="text-sm tabular-nums text-muted">
                    {month.absences} {month.absences === 1 ? "falta" : "faltas"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <p className="mt-4 text-sm" aria-live="polite">
        {picked.length === 0 ? (
          <span className="text-prio-urgent">Marque pelo menos um mês.</span>
        ) : (
          <>
            No termo: <strong>{absencesText(total)}</strong> {absenceMonthsText(picked)}.
          </>
        )}
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          disabled={picked.length === 0}
          onClick={() => onConfirm(picked.map((month) => month.month))}
        >
          Gerar documento
        </Button>
      </div>
    </Modal>
  );
}
