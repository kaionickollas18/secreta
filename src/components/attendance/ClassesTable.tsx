import type { ClassSummary } from "../../types/attendance";
import { formatNumber } from "../../utils/attendance";
import { Button } from "../ui/Button";

interface ClassesTableProps {
  classes: ClassSummary[];
  /** Baixa o relatório da turma em PDF. */
  onPrint?: (className: string) => void;
}

export function ClassesTable({ classes, onPrint }: ClassesTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">Resumo de faltas por turma</caption>
        <thead className="bg-raised/60 text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2.5">Turma</th>
            <th scope="col" className="px-3 py-2.5 text-right">Dias</th>
            <th scope="col" className="px-3 py-2.5 text-right">Faltas</th>
            <th scope="col" className="px-3 py-2.5 text-right">Média/dia</th>
            <th scope="col" className="px-3 py-2.5 text-right">Alunos c/ falta</th>
            <th scope="col" className="px-3 py-2.5 text-right">Críticos</th>
            <th scope="col" className="px-3 py-2.5">Quem mais falta</th>
            {onPrint && (
              <th scope="col" className="px-3 py-2.5">
                <span className="sr-only">Relatório</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {classes.map((c) => (
            <tr key={c.name} className="border-t border-line hover:bg-raised/40">
              <th scope="row" className="px-3 py-2.5 font-medium whitespace-nowrap">{c.name}</th>
              <td className="px-3 py-2.5 text-right tabular-nums">{c.days}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{c.absences}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(c.avgPerDay)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{c.studentsWithAbsence}</td>
              <td
                className={`px-3 py-2.5 text-right tabular-nums ${c.critical > 0 ? "font-semibold text-prio-urgent" : "text-muted"}`}
              >
                {c.critical}
              </td>
              <td className="px-3 py-2.5">
                {c.topStudent ? `${c.topStudent.name} (${c.topStudent.absences})` : "—"}
              </td>
              {onPrint && (
                <td className="px-3 py-1.5 text-right">
                  <Button
                    aria-label={`Baixar relatório da turma ${c.name}`}
                    disabled={c.days === 0}
                    onClick={() => onPrint(c.name)}
                    className="!min-h-[32px] px-3 text-xs"
                  >
                    PDF
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
