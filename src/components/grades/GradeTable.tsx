import { useId, useState } from "react";
import type { Classroom } from "../../types/grade";
import {
  brDate,
  classDisplayName,
  formatScore,
  RESULT_LABELS,
  type SubjectBlock,
} from "../../utils/grades";

interface GradeTableProps {
  classroom: Classroom;
  block: SubjectBlock;
  /** Começa aberta (com filtro de disciplina ou busca por nome); senão, recolhida. */
  defaultOpen?: boolean;
  /** Alunos da turma de reforço (ganham a marca "Reforço"). */
  reinforced: ReadonlySet<string>;
  /** Abre o perfil do aluno. */
  onOpenStudent: (studentId: string) => void;
}

/**
 * Notas de uma disciplina da turma no bimestre: média (MD), faltas (FT) e histórico. Abre e
 * fecha pelo nome da matéria; recolhida, mostra só o nome e um resumo.
 */
export function GradeTable({
  classroom,
  block,
  defaultOpen = false,
  reinforced,
  onOpenStudent,
}: GradeTableProps) {
  const { subject, lines } = block;
  const caption = `${classDisplayName(classroom.name)} · ${subject.name}`;
  const panelId = useId();
  // Aberta ou fechada à mão; sem toque, segue o padrão (que muda com os filtros).
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? defaultOpen;
  const failed = lines.filter((line) => line.result === "failed").length;

  return (
    <section className="glass overflow-hidden rounded-2xl" aria-label={caption}>
      {/* Só a matéria: segmento, turma e turno já estão no título do segmento e na barra da turma.
          O professor da matéria entra aqui quando houver um documento com ele. */}
      <h4>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setToggled(!open)}
          className={`flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2 text-left ${
            open ? "border-b border-line" : ""
          }`}
        >
          <span className="text-sm font-semibold uppercase text-accent-light">
            {subject.name}
          </span>
          <span className="flex items-center gap-3 text-sm text-muted">
            <span>
              {lines.length} {lines.length === 1 ? "aluno" : "alunos"}
              {failed > 0 && (
                <span className="text-prio-urgent">
                  {" "}
                  · {failed} {failed === 1 ? "reprovado(a)" : "reprovados(as)"}
                </span>
              )}
            </span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`h-5 w-5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
      </h4>

      <div id={panelId} hidden={!open} className="overflow-x-auto">
        {open && (
          <table className="w-full min-w-[520px] border-collapse text-sm tabular-nums">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="w-10 px-2 py-2 text-center">
                  Nº
                </th>
                <th scope="col" className="px-2 py-2">
                  Aluno
                </th>
                <th scope="col" className="w-16 px-2 py-2 text-center">
                  <abbr title="Média do bimestre">MD</abbr>
                </th>
                <th scope="col" className="w-14 px-2 py-2 text-center">
                  <abbr title="Faltas">FT</abbr>
                </th>
                <th scope="col" className="w-36 px-2 py-2 text-center">
                  Histórico
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map(({ row, student, result }) => (
                <tr
                  key={student.id}
                  className="border-b border-line last:border-b-0 even:bg-canvas/40"
                >
                  <td className="px-2 py-2 text-center font-semibold">
                    {student.rollNumber ?? ""}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => onOpenStudent(student.id)}
                      aria-label={`Ver o perfil de ${student.name}`}
                      className="rounded text-left uppercase text-accent-light underline-offset-2 hover:underline"
                    >
                      {student.name}
                    </button>
                    {student.notes && (
                      <span className="uppercase text-muted"> - {student.notes}</span>
                    )}
                    {student.transferred && (
                      <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-prio-medium-tint px-2 text-2xs font-semibold text-prio-medium">
                        TRF
                        {student.transferredOn ? ` ${brDate(student.transferredOn)}` : ""}
                      </span>
                    )}
                    {reinforced.has(student.id) && (
                      <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-accent-soft px-2 text-2xs font-semibold text-accent-light">
                        Reforço
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center font-semibold">
                    {formatScore(row.md)}
                  </td>
                  <td className="px-2 py-2 text-center">{row.ft ?? ""}</td>
                  <td
                    className={`px-2 py-2 text-center font-semibold ${
                      result === "failed" ? "text-prio-urgent" : "text-accent-light"
                    }`}
                  >
                    {result ? RESULT_LABELS[result] : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
