import type { Classroom } from "../../types/grade";
import {
  brDate,
  classDisplayName,
  formatScore,
  RESULT_LABELS,
  SEGMENT_LABELS,
  type SubjectBlock,
} from "../../utils/grades";

interface GradeTableProps {
  classroom: Classroom;
  block: SubjectBlock;
  /** Abre o boletim do aluno. */
  onOpenStudent: (studentId: string) => void;
}

/** Notas de uma disciplina da turma no bimestre: média (MD), faltas (FT) e histórico. */
export function GradeTable({ classroom, block, onOpenStudent }: GradeTableProps) {
  const { subject, lines } = block;
  const caption = `${classDisplayName(classroom.name)} · ${subject.name}`;

  return (
    <section className="glass overflow-hidden rounded-2xl" aria-label={caption}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wide text-accent-light">
            {SEGMENT_LABELS[classroom.segment]}
          </p>
          <p className="card-title uppercase">
            {classDisplayName(classroom.name)} · {classroom.shift}
          </p>
          <p className="text-sm font-semibold uppercase text-accent-light">{subject.name}</p>
        </div>
        {/* O boletim não diz quem dá cada disciplina: vão os professores da turma. */}
        <div className="min-w-0 max-w-full sm:max-w-[50%] sm:text-right">
          <p className="text-2xs font-semibold uppercase tracking-wide text-accent-light">Professores da turma</p>
          <p className="text-sm font-semibold uppercase">{classroom.teachers || "Não informados"}</p>
        </div>
      </header>

      <div className="overflow-x-auto">
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
              <tr key={student.id} className="border-b border-line last:border-b-0 even:bg-canvas/40">
                <td className="px-2 py-2 text-center font-semibold">{student.rollNumber ?? ""}</td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenStudent(student.id)}
                    aria-label={`Ver o boletim de ${student.name}`}
                    className="rounded text-left uppercase text-accent-light underline-offset-2 hover:underline"
                  >
                    {student.name}
                  </button>
                  {student.notes && <span className="uppercase text-muted"> - {student.notes}</span>}
                  {student.transferred && (
                    <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-prio-medium-tint px-2 text-2xs font-semibold text-prio-medium">
                      TRF{student.transferredOn ? ` ${brDate(student.transferredOn)}` : ""}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center font-semibold">{formatScore(row.md)}</td>
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
      </div>
    </section>
  );
}
