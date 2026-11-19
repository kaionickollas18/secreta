import type { GradeStudent, ReinforcementEntry } from "../../types/grade";
import { classDisplayName, compareClassrooms } from "../../utils/grades";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";

interface ReinforcementListModalProps {
  open: boolean;
  entries: ReinforcementEntry[];
  students: GradeStudent[];
  onClose: () => void;
  /** Abre o perfil do aluno. */
  onOpenStudent: (studentId: string) => void;
}

const formatDay = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
};

/** Todos os alunos da turma de reforço, por turma; o nome abre o perfil. */
export function ReinforcementListModal({
  open,
  entries,
  students,
  onClose,
  onOpenStudent,
}: ReinforcementListModalProps) {
  const byId = new Map(students.map((student) => [student.id, student]));
  const rows = entries
    .flatMap((entry) => {
      const student = byId.get(entry.studentId);
      return student ? [{ entry, student }] : [];
    })
    .sort(
      (a, b) =>
        compareClassrooms({ name: a.student.className }, { name: b.student.className }) ||
        a.student.name.localeCompare(b.student.name, "pt-BR"),
    );

  return (
    <Modal open={open} size="wide" title="Turma de reforço" onClose={onClose}>
      {rows.length === 0 ? (
        <EmptyState
          title="Nenhum aluno no reforço ainda"
          description="Abra o perfil de um aluno (tocando no nome dele) e use “Adicionar à turma de reforço”."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="caption">
            {rows.length} {rows.length === 1 ? "aluno" : "alunos"}. Quando as avaliações
            bimestrais forem lançadas, os resultados deles aparecem aqui com mais
            detalhes.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <caption className="sr-only">Alunos da turma de reforço</caption>
              <thead>
                <tr className="border-b border-line bg-canvas/40 text-left">
                  <th scope="col" className="px-3 py-2">
                    Aluno
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Turma
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Motivo
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Desde
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry, student }) => (
                  <tr key={student.id} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenStudent(student.id)}
                        aria-label={`Ver o perfil de ${student.name}`}
                        className="text-left uppercase text-accent-light underline-offset-2 hover:underline"
                      >
                        {student.name}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {classDisplayName(student.className)}
                    </td>
                    <td className="px-3 py-2 text-muted">{entry.note || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {formatDay(entry.addedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
