import { useState } from "react";
import { saveStudentList } from "../../store/gradeApi";
import type { GradeStudent } from "../../types/grade";
import { brDate, classDisplayName } from "../../utils/grades";
import type { TextItem } from "../../utils/pdfText";
import { planStudentImport, type StudentImportPlan } from "../../utils/studentImport";
import { parseStudentList } from "../../utils/studentListParser";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { PdfPicker } from "./PdfPicker";

interface StudentListImportModalProps {
  open: boolean;
  schoolId: string;
  schoolYear: number;
  /** Cadastro atual do ano, para não duplicar. */
  students: GradeStudent[];
  onClose: () => void;
  /** Depois de salvar: recarregar a página de notas. */
  onSaved: (message: string) => void;
}

/** Envio da "Relação de alunos matriculados por turma": prévia por turma e gravação. */
export function StudentListImportModal({
  open,
  schoolId,
  schoolYear,
  students,
  onClose,
  onSaved,
}: StudentListImportModalProps) {
  const [plan, setPlan] = useState<StudentImportPlan | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function close() {
    if (saving) return;
    setPlan(null);
    setProblem(null);
    onClose();
  }

  function handleRead(items: TextItem[]) {
    const list = parseStudentList(items);
    setPlan(null);
    if (list.classes.length === 0) {
      setProblem("Nenhuma turma encontrada. Confira se o arquivo é a “Relação de alunos matriculados por turma”.");
      return;
    }
    if (list.schoolYear !== null && list.schoolYear !== schoolYear) {
      setProblem(`A lista é do ano letivo ${list.schoolYear}; a página está em ${schoolYear}.`);
      return;
    }
    setProblem(null);
    setPlan(planStudentImport(list, students, schoolYear));
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    const error = await saveStudentList(schoolId, plan);
    setSaving(false);
    if (error) {
      setProblem(error);
      return;
    }
    const message = `Cadastro atualizado: ${plan.updated} ${plan.updated === 1 ? "aluno conferido" : "alunos conferidos"}, ${plan.created} ${plan.created === 1 ? "novo" : "novos"}.`;
    setPlan(null);
    onSaved(message);
  }

  return (
    <Modal open={open} title="Cadastro dos alunos matriculados" onClose={close}>
      <div className="flex flex-col gap-4">
        <p className="caption">
          Envie o PDF “Relação de alunos matriculados por turma” do sistema da rede, com todas as turmas. Quem já está
          no cadastro é atualizado, sem duplicar; as turmas de Atendimento Educacional Especializado ficam de fora.
        </p>
        <PdfPicker label="Arquivo PDF da lista" disabled={saving} onRead={handleRead} />
        {problem && (
          <p role="alert" className="text-sm text-prio-urgent">
            {problem}
          </p>
        )}

        {plan && (
          <section aria-label="Prévia da lista" className="flex flex-col gap-3">
            <p className="text-sm">
              <strong>{plan.rows.length} alunos</strong> em {plan.classrooms.length} turmas: {plan.updated} já no
              cadastro, {plan.created} {plan.created === 1 ? "novo" : "novos"}, {plan.transferred}{" "}
              {plan.transferred === 1 ? "transferido" : "transferidos"}.
            </p>
            <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-2xl border border-line text-sm">
              {plan.classrooms.map((classroom) => {
                const rows = plan.rows.filter((row) => row.className === classroom.name);
                const transferred = rows.filter((row) => row.student.transferred);
                return (
                  <li key={classroom.name} className="px-3 py-2">
                    <p className="font-semibold">
                      {classDisplayName(classroom.name)} · {classroom.shift} — {rows.length} alunos
                    </p>
                    {transferred.length > 0 && (
                      <p className="text-muted">
                        TRF:{" "}
                        {transferred
                          .map((row) => `${row.student.name}${row.student.transferredOn ? ` (${brDate(row.student.transferredOn)})` : ""}`)
                          .join(", ")}
                      </p>
                    )}
                    {rows.some((row) => row.student.notes) && (
                      <p className="text-muted">
                        Observações:{" "}
                        {rows
                          .filter((row) => row.student.notes)
                          .map((row) => `${row.student.name} (${row.student.notes})`)
                          .join(", ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {plan.skipped.length > 0 && <p className="caption">Ignoradas: {plan.skipped.join("; ")}.</p>}
            {plan.notInList.length > 0 && (
              <p className="caption">
                {plan.notInList.length} {plan.notInList.length === 1 ? "aluno do cadastro não está" : "alunos do cadastro não estão"} na
                lista e continuam como estão: {plan.notInList.map((s) => `${s.name} (${s.className})`).join(", ")}.
              </p>
            )}
          </section>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!plan || saving} onClick={() => void save()}>
            {saving ? "Salvando…" : "Salvar cadastro"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
