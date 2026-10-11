import { useState } from "react";
import type { StudentSummary } from "../../types/attendance";
import { formatPercent, STREAK_ALERT } from "../../utils/attendance";
import { Button } from "../ui/Button";
import { RiskBadge } from "./RiskBadge";

interface StudentsTableProps {
  students: StudentSummary[];
  showClass: boolean;
  /** Abre o resumo individual do aluno. */
  onSelect: (student: StudentSummary) => void;
}

const PAGE = 15;

export function StudentsTable({ students, showClass, onSelect }: StudentsTableProps) {
  const [limit, setLimit] = useState(PAGE);
  const visible = students.slice(0, limit);

  if (students.length === 0) {
    return <p className="text-sm text-muted">Nenhum aluno encontrado.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Alunos ordenados por número de faltas</caption>
          <thead className="bg-raised/60 text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2.5">#</th>
              <th scope="col" className="px-3 py-2.5">Aluno</th>
              {showClass && <th scope="col" className="px-3 py-2.5">Turma</th>}
              <th scope="col" className="px-3 py-2.5 text-right">Faltas</th>
              <th scope="col" className="px-3 py-2.5 text-right">% dos dias</th>
              <th scope="col" className="px-3 py-2.5 text-right">Seguidas</th>
              <th scope="col" className="px-3 py-2.5">Situação</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => (
              <tr key={`${s.className}-${s.name}`} className="border-t border-line hover:bg-raised/40">
                <td className="px-3 py-2.5 text-muted">{i + 1}</td>
                <th scope="row" className="px-3 py-2.5 font-medium">
                  <button
                    type="button"
                    onClick={() => onSelect(s)}
                    aria-label={`Ver resumo de ${s.name}`}
                    className="rounded text-left underline decoration-line underline-offset-4 hover:decoration-accent-light"
                  >
                    {s.name}
                  </button>
                </th>
                {showClass && <td className="px-3 py-2.5 whitespace-nowrap">{s.className}</td>}
                <td className="px-3 py-2.5 text-right tabular-nums">{s.absences}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(s.rate)}</td>
                <td
                  className={`px-3 py-2.5 text-right tabular-nums ${s.streak >= STREAK_ALERT ? "font-semibold text-prio-urgent" : "text-muted"}`}
                >
                  {s.streak}
                </td>
                <td className="px-3 py-2.5">
                  <RiskBadge risk={s.risk} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {students.length > limit && (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
          <span>
            Mostrando {visible.length} de {students.length}
          </span>
          <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE * 2)}>
            Mostrar mais
          </Button>
        </div>
      )}
    </div>
  );
}
