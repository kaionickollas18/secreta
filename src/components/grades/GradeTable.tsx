import type { Classroom } from "../../types/grade";
import { brDate, classDisplayName, formatScore, RESULT_LABELS, type SubjectBlock } from "../../utils/grades";

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
      {/* Só a matéria: segmento, turma e turno já estão no título do segmento e na barra da turma.
          O professor da matéria entra aqui quando houver um documento com ele. */}
      <header className="border-b border-line px-4 py-2.5">
        <h4 className="text-sm font-semibold uppercase text-accent-light">{subject.name}</h4>
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
