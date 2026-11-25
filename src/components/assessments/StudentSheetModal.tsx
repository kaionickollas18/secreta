import type { Assessment } from "../../types/assessment";
import type { StudentResult } from "../../utils/assessmentAnalytics";
import { descriptorLookup, formatPercent } from "../../utils/assessments";
import { Modal } from "../ui/Modal";

interface StudentSheetModalProps {
  assessment: Assessment;
  result: StudentResult | null;
  onClose: () => void;
}

const OUTCOME = {
  right: { text: "Acertou", className: "text-prio-low" },
  wrong: { text: "Errou", className: "text-prio-urgent" },
  blank: { text: "Em branco", className: "text-prio-medium" },
  annulled: { text: "Anulada", className: "text-muted" },
} as const;

/** Cartão individual: resposta de cada questão contra o gabarito, com o descritor. */
export function StudentSheetModal({ assessment, result, onClose }: StudentSheetModalProps) {
  const lookup = descriptorLookup(assessment);
  return (
    <Modal open={result !== null} title={result ? result.sheet.studentName : ""} onClose={onClose} size="wide">
      {result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            <strong className="tabular-nums">
              {result.score.correct}/{result.score.scored}
            </strong>{" "}
            acertos ({formatPercent(result.score.percent)}) · {assessment.title}
            {result.critical && <span className="ml-2 font-semibold text-prio-urgent">Situação crítica</span>}
          </p>
          {result.gaps.length > 0 && (
            <div className="rounded-xl bg-prio-urgent-tint px-3 py-2 text-sm">
              <p className="font-semibold text-prio-urgent">Descritores não consolidados</p>
              <ul className="mt-1 space-y-0.5">
                {result.gaps.map((g) => (
                  <li key={g.descriptor.code}>
                    <strong>{g.descriptor.code}</strong> ({g.correct}/{g.total}) <span className="text-muted">{g.descriptor.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Questão</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Marcou</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Gabarito</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Resultado</th>
                  <th scope="col" className="py-2 font-medium">Descritor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {assessment.questions.map((q, i) => {
                  const outcome = OUTCOME[result.score.outcomes[i] ?? "blank"];
                  return (
                    <tr key={q.number}>
                      <th scope="row" className="py-1.5 pr-3 font-bold tabular-nums">{q.number}</th>
                      <td className="py-1.5 pr-3 font-semibold">{result.sheet.answers[i] ?? "–"}</td>
                      <td className="py-1.5 pr-3">{q.key ?? "–"}</td>
                      <td className={`py-1.5 pr-3 font-semibold ${outcome.className}`}>{outcome.text}</td>
                      <td className="py-1.5" title={q.descriptorCodes.map((c) => lookup.get(c)?.text ?? c).join(" · ")}>
                        {q.descriptorCodes.join(", ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="caption">
            Origem: {result.sheet.source === "manual" ? "lançamento manual" : "leitura do cartão"}
            {result.sheet.edited ? ", com ajuste manual na conferência" : ""}.
          </p>
        </div>
      )}
    </Modal>
  );
}
