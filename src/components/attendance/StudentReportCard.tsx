import type { RiskLevel, StudentReport } from "../../types/attendance";
import { formatDay, formatPercent, STREAK_ALERT } from "../../utils/attendance";
import { Button } from "../ui/Button";
import { RiskBadge } from "./RiskBadge";

const BAR: Record<RiskLevel, string> = {
  ok: "bg-prio-low",
  warning: "bg-prio-medium",
  critical: "bg-prio-urgent",
};

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-canvas/40 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-xl font-bold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

interface StudentReportCardProps {
  report: StudentReport;
  onClose: () => void;
}

/** Resumo de um aluno: situação geral e a frequência de cada mês. */
export function StudentReportCard({ report, onClose }: StudentReportCardProps) {
  const days = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
  const absencesText = (n: number) => `${n} ${n === 1 ? "falta" : "faltas"}`;

  return (
    <article
      aria-labelledby="h-report"
      className="animate-enter rounded-3xl border border-accent/40 bg-accent-soft/40 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="h-report" className="break-words panel-title">
            {report.name}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Turma {report.className}</span>
            <RiskBadge risk={report.risk} />
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Fechar resumo
        </Button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Frequência no período"
          value={formatPercent(report.presenceRate)}
          tone={report.risk === "critical" ? "text-prio-urgent" : ""}
        />
        <Stat label="Faltas" value={`${report.absences} de ${days(report.schoolDays)}`} />
        <Stat
          label="Faltas seguidas"
          value={String(report.streak)}
          tone={report.streak >= STREAK_ALERT ? "text-prio-urgent" : ""}
        />
        <Stat label="Última falta" value={report.lastAbsence ? formatDay(report.lastAbsence) : "—"} />
      </dl>

      {report.risk === "critical" && (
        <p className="mt-3 text-sm text-prio-urgent">
          Frequência abaixo de 75%: risco de reprovação por faltas.
        </p>
      )}
      {report.streak >= STREAK_ALERT && (
        <p className="mt-1 text-sm text-prio-urgent">
          {report.streak} faltas seguidas até o último dia de chamada: vale entrar em contato com a família.
        </p>
      )}

      <h4 className="mb-2 mt-5 card-title">Frequência por mês</h4>
      <ul className="space-y-2">
        {report.months.map((month, index) => {
          const worst = month.month === report.worstMonth;
          return (
            <li
              key={month.month}
              className={`rounded-2xl border px-3 py-2.5 ${worst ? "border-prio-urgent/60 bg-prio-urgent-tint" : "border-line bg-canvas/40"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {month.label}
                  {worst && (
                    <span className="rounded-full bg-prio-urgent px-2 py-0.5 text-2xs font-bold text-canvas">
                      Pior mês
                    </span>
                  )}
                  {month.risk !== "ok" && <RiskBadge risk={month.risk} />}
                </p>
                <p className="text-sm tabular-nums">
                  <strong className="text-base">{formatPercent(month.presenceRate)}</strong>
                  <span className="text-muted">
                    {" "}
                    de frequência · {absencesText(month.absences)} em {days(month.schoolDays)}
                  </span>
                </p>
              </div>
              <div
                role="img"
                aria-label={`${month.label}: ${formatPercent(month.presenceRate)} de frequência`}
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-raised"
              >
                <div
                  className={`h-full origin-left animate-bar rounded-full ${BAR[month.risk]}`}
                  style={{
                    width: `${Math.round(month.presenceRate * 100)}%`,
                    // Sequência curta: no máximo 300 ms de espera, mesmo com muitos meses.
                    animationDelay: `${Math.min(index * 60, 300)}ms`,
                  }}
                />
              </div>
              {month.dates.length > 0 && (
                <p className="mt-2 caption">
                  Faltou em: {month.dates.map((date) => formatDay(date).slice(0, 5)).join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 caption">
        A frequência considera os dias de chamada registrados para a turma. Regular: até 15% de faltas ·
        Atenção: de 15% a 25% · Crítico: mais de 25%.
      </p>
    </article>
  );
}
