import { useMemo } from "react";
import type { Classroom, GradeRow, GradeStudent, Subject } from "../../types/grade";
import { brDate, classDisplayName, formatScore, PASSING_MD } from "../../utils/grades";
import { buildReportCard, overallAverage, termAverages } from "../../utils/reportCard";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { AbsenceChart, AverageChart } from "./StudentEvolution";

interface StudentProfileModalProps {
  student: GradeStudent | null;
  classroom: Classroom | null;
  subjects: Subject[];
  /** Notas do aluno nos quatro bimestres, ou o andamento da carga. */
  grades: GradeRow[] | "loading" | "error" | undefined;
  onClose: () => void;
  onRetry: () => void;
  onOpenReportCard: () => void;
}

const TERMS = [0, 1, 2, 3];

/** Um número em destaque no topo do perfil. */
function Stat({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-canvas/40 px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${alert ? "text-prio-urgent" : ""}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * Perfil do aluno (ao tocar no nome dele): dados da matrícula, a evolução do ano (média geral e
 * faltas de cada bimestre, e cada matéria bimestre a bimestre) e os documentos do aluno.
 */
export function StudentProfileModal({
  student,
  classroom,
  subjects,
  grades,
  onClose,
  onRetry,
  onOpenReportCard,
}: StudentProfileModalProps) {
  const report = useMemo(
    () => (Array.isArray(grades) ? buildReportCard(grades, subjects) : null),
    [grades, subjects],
  );
  if (!student) return null;

  const averages = report ? termAverages(report) : [];
  const overall = report ? overallAverage(report) : null;
  const below = report
    ? report.subjects.filter((s) => s.average !== null && s.average < PASSING_MD).length
    : 0;
  const className = classroom
    ? `${classDisplayName(classroom.name)} · ${classroom.shift}`
    : student.className.toUpperCase();

  return (
    <Modal open size="wide" title={student.name} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <div className="flex gap-1">
            <dt className="text-muted">Turma:</dt>
            <dd className="font-semibold uppercase">{className}</dd>
          </div>
          {student.rollNumber !== null && (
            <div className="flex gap-1">
              <dt className="text-muted">Nº:</dt>
              <dd className="font-semibold">{student.rollNumber}</dd>
            </div>
          )}
          {student.registration && (
            <div className="flex gap-1">
              <dt className="text-muted">Matrícula:</dt>
              <dd className="font-semibold">{student.registration}</dd>
            </div>
          )}
          {student.notes && (
            <div className="flex gap-1">
              <dt className="text-muted">Observação:</dt>
              <dd className="font-semibold uppercase">{student.notes}</dd>
            </div>
          )}
          {student.transferred && (
            <div>
              <dt className="sr-only">Situação:</dt>
              <dd className="rounded-full bg-prio-medium-tint px-2 text-xs font-semibold text-prio-medium">
                Transferido(a)
                {student.transferredOn ? ` em ${brDate(student.transferredOn)}` : ""}
              </dd>
            </div>
          )}
        </dl>

        <nav
          aria-label="Documentos do aluno"
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        >
          <Button variant="primary" onClick={onOpenReportCard}>
            Boletim
          </Button>
          <Button disabled title="Em breve">
            Avaliações bimestrais
            <span className="rounded-full bg-accent-soft px-2 text-2xs text-accent-light">
              Em breve
            </span>
          </Button>
          <Button disabled title="Em breve">
            Histórico escolar
            <span className="rounded-full bg-accent-soft px-2 text-2xs text-accent-light">
              Em breve
            </span>
          </Button>
        </nav>

        {grades === "error" ? (
          <p role="alert" className="text-sm text-prio-urgent">
            Não foi possível carregar as notas do aluno.{" "}
            <button type="button" className="underline" onClick={onRetry}>
              Tentar de novo
            </button>
          </p>
        ) : !report ? (
          <div>
            <p role="status" className="sr-only">
              Carregando a evolução do aluno…
            </p>
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : report.subjects.length === 0 ? (
          <p className="text-sm text-muted">Este aluno ainda não tem notas enviadas.</p>
        ) : (
          <section aria-label="Evolução no ano" className="flex flex-col gap-4">
            <h3 className="section-title">Evolução no ano</h3>
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label={report.complete ? "Média final" : "Média parcial"}
                value={overall === null ? "–" : formatScore(overall)}
                alert={overall !== null && overall < PASSING_MD}
              />
              <Stat label="Faltas no ano" value={String(report.absences)} />
              <Stat
                label="Matérias abaixo de 6,0"
                value={String(below)}
                alert={below > 0}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AverageChart averages={averages} />
              <AbsenceChart absences={report.absencesByTerm} />
            </div>

            {/* Cada matéria bimestre a bimestre (também é a versão em tabela dos gráficos). */}
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[440px] border-collapse text-sm tabular-nums">
                <caption className="sr-only">Média de cada matéria por bimestre</caption>
                <thead>
                  <tr className="border-b border-line bg-canvas/40 text-left">
                    <th scope="col" className="px-3 py-2">
                      Matéria
                    </th>
                    {TERMS.map((i) => (
                      <th key={i} scope="col" className="w-14 px-2 py-2 text-center">
                        {i + 1}º
                      </th>
                    ))}
                    <th scope="col" className="w-20 px-2 py-2 text-center">
                      Média
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.subjects.map((subject) => (
                    <tr
                      key={subject.name}
                      className="border-b border-line last:border-b-0"
                    >
                      <th
                        scope="row"
                        className="px-3 py-1.5 text-left text-xs font-semibold uppercase"
                      >
                        {subject.name}
                      </th>
                      {subject.terms.map((md, i) => (
                        <td
                          key={i}
                          className={`px-2 py-1.5 text-center ${md !== null && md < PASSING_MD ? "font-semibold text-prio-urgent" : ""}`}
                        >
                          {md === null ? "" : formatScore(md)}
                        </td>
                      ))}
                      <td
                        className={`px-2 py-1.5 text-center font-semibold ${
                          subject.average !== null && subject.average < PASSING_MD
                            ? "text-prio-urgent"
                            : ""
                        }`}
                      >
                        {subject.average === null ? "" : formatScore(subject.average)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-line bg-canvas/40 font-semibold">
                    <th scope="row" className="px-3 py-1.5 text-left text-xs uppercase">
                      Média geral
                    </th>
                    {averages.map((md, i) => (
                      <td key={i} className="px-2 py-1.5 text-center">
                        {md === null ? "" : formatScore(md)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center">
                      {overall === null ? "" : formatScore(overall)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
