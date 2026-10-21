import { createPortal } from "react-dom";
import type { SchoolIdentity } from "../../types/school";
import { formatDay, formatNumber, formatPercent, RISK_LABELS } from "../../utils/attendance";
import { BAR_BOX, monthBars, TOP_STUDENTS, type ClassReport } from "../../utils/classReport";
import { monthShort, periodText, spansYears } from "../../utils/reportChart";
import { DocumentFooter } from "./DocumentFooter";
import { DocumentHeader } from "./DocumentHeader";

interface ClassDocumentProps {
  report: ClassReport;
  identity: SchoolIdentity;
  /** Nome de quem emite (vai no rodapé). */
  issuedBy: string;
  /** Data de emissão (YYYY-MM-DD). */
  issuedOn: string;
}

const TITLE = "Relatório de Frequência da Turma";
const RISK_ORDER = ["critical", "warning", "ok"] as const;

/** Média de faltas por dia em cada mês, em barras; o mês com a maior média fica em destaque. */
function MonthBarsChart({ report }: { report: ClassReport }) {
  const { bars, ticks } = monthBars(report.months);
  const { width, height, left, right } = BAR_BOX;
  const withYear = spansYears(report.months);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="doc-chart-svg">
      {ticks.map((tick) => (
        <g key={tick.y}>
          <line x1={left} x2={width - right} y1={tick.y} y2={tick.y} className="doc-chart-grid" />
          <text x={left - 8} y={tick.y + 4} textAnchor="end" className="doc-chart-axis">
            {formatNumber(tick.value)}
          </text>
        </g>
      ))}
      {bars.map((bar) => (
        <g key={bar.month}>
          <rect
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={Math.max(bar.height, 0.5)}
            rx="6"
            className={bar.peak ? "doc-bar-peak" : "doc-bar-month"}
          />
          <text x={bar.x + bar.width / 2} y={bar.y - 8} textAnchor="middle" className="doc-chart-value">
            {formatNumber(bar.value)}
          </text>
          <text x={bar.x + bar.width / 2} y={height - 8} textAnchor="middle" className="doc-chart-axis">
            {monthShort(bar.month, withYear)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Relatório de frequência da turma em formato de documento oficial, no mesmo visual do
 * relatório do aluno. Página 1: resumo da turma. Página 2: os alunos que mais faltam (até 10).
 * Fica fora da tela e só aparece na impressão. Estilos em `index.css` (`.doc-*`).
 */
export function ClassDocument({ report, identity, issuedBy, issuedOn }: ClassDocumentProps) {
  const period = periodText(report.months);
  const atRisk = report.byRisk.critical + report.byRisk.warning;
  const peakWeekday = Math.max(...report.weekdays.map((w) => w.avgAbsences));
  const weekdayScale = peakWeekday > 0 ? peakWeekday : 1;

  return createPortal(
    <div className="print-document doc" aria-hidden="true">
      {identity.logoUrl && <img src={identity.logoUrl} alt="" className="print-watermark" />}

      {/* ─────────────── Página 1: resumo da turma ─────────────── */}
      <DocumentHeader identity={identity} title={TITLE} issuedOn={issuedOn} />

      <section className="doc-kpis">
        <div className="doc-card doc-student">
          <span className="doc-pill">Turma</span>
          <p className="doc-student-name">{report.name}</p>
          <p className="doc-student-class">
            {period && (
              <>
                Período: <strong>{period}</strong> ·{" "}
              </>
            )}
            <strong>{report.schoolDays}</strong> {report.schoolDays === 1 ? "dia" : "dias"} de chamada
          </p>
          <span className={`doc-pill doc-risk-${report.byRisk.critical > 0 ? "critical" : atRisk > 0 ? "warning" : "ok"}`}>
            {atRisk === 0
              ? "Nenhum aluno em risco"
              : `${atRisk} ${atRisk === 1 ? "aluno pede" : "alunos pedem"} atenção`}
          </span>
        </div>

        <div className="doc-card doc-kpi">
          <p className="doc-kpi-label">Faltas no período</p>
          <p className="doc-kpi-value">{report.absences}</p>
          <p className="doc-kpi-sub">
            em {report.schoolDays} {report.schoolDays === 1 ? "dia" : "dias"} de chamada
          </p>
        </div>

        <div className="doc-card doc-kpi">
          <p className="doc-kpi-label">Média de faltas por dia</p>
          <p className="doc-kpi-value">{formatNumber(report.avgPerDay)}</p>
          <p className="doc-kpi-sub">
            {report.busiestDay
              ? `Dia com mais faltas: ${formatDay(report.busiestDay.date)} (${report.busiestDay.absences})`
              : "Nenhuma falta no período"}
          </p>
        </div>

        <div className="doc-card doc-kpi">
          <p className="doc-kpi-label">Alunos com falta</p>
          <p className="doc-kpi-value">{report.studentsWithAbsence}</p>
          <p className="doc-kpi-sub">
            {report.byRisk.critical} em situação crítica (mais de 25% de faltas)
          </p>
        </div>
      </section>

      <section className="doc-card doc-chart">
        <div className="doc-chart-body">
          <div className="doc-chart-plot">
            <div className="doc-card-head">
              <h2 className="doc-section-title">Média de faltas por dia, mês a mês</h2>
              <p className="doc-legend">
                <span className="doc-legend-item">
                  <span className="doc-legend-swatch doc-legend-swatch-peak" />
                  Mês com a maior média
                </span>
              </p>
            </div>
            <MonthBarsChart report={report} />
          </div>

          <div className="doc-facts">
            <p className="doc-kpi-label">Situação dos alunos que faltaram</p>
            <div className="doc-stack" aria-hidden="true">
              {RISK_ORDER.map((risk) =>
                report.byRisk[risk] > 0 ? (
                  <span
                    key={risk}
                    className={`doc-stack-part doc-risk-fill-${risk}`}
                    style={{ flexGrow: report.byRisk[risk] }}
                  />
                ) : null,
              )}
            </div>
            {RISK_ORDER.map((risk) => (
              <div key={risk} className="doc-fact doc-fact-row">
                <span className={`doc-dot doc-risk-fill-${risk}`} />
                <span className="doc-fact-label">{RISK_LABELS[risk]}</span>
                <span className="doc-fact-value">{report.byRisk[risk]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="doc-row">
        <div className="doc-card">
          <h2 className="doc-section-title">Faltas por dia da semana</h2>
          <p className="doc-muted">Média de faltas por dia de chamada.</p>
          <ul className="doc-weekdays">
            {report.weekdays.map((day) => (
              <li key={day.weekday} className="doc-weekday">
                <span className="doc-weekday-label">{day.label}</span>
                <span className="doc-bar-track">
                  <span
                    className={`doc-bar-fill ${day.avgAbsences === peakWeekday && peakWeekday > 0 ? "doc-fill-peak" : "doc-fill-accent"}`}
                    style={{ width: `${Math.round((day.avgAbsences / weekdayScale) * 100)}%` }}
                  />
                </span>
                <span className="doc-bar-value">{day.days > 0 ? formatNumber(day.avgAbsences) : "—"}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="doc-card">
          <h2 className="doc-section-title">Destaques</h2>
          {report.insights.length === 0 ? (
            <p className="doc-muted">Sem dados suficientes para destaques.</p>
          ) : (
            <ul className="doc-insights">
              {report.insights.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ─────────────── Página 2: alunos que mais faltam ─────────────── */}
      <div className="doc-page-break">
        <DocumentHeader identity={identity} title={TITLE} issuedOn={issuedOn} />

        <section className="doc-card doc-months">
          <div className="doc-card-head">
            <h2 className="doc-section-title">
              Alunos com mais faltas · {report.name}
            </h2>
            <p className="doc-muted">
              {report.top.length < TOP_STUDENTS
                ? `${report.top.length} ${report.top.length === 1 ? "aluno faltou" : "alunos faltaram"} no período`
                : `Os ${TOP_STUDENTS} primeiros de ${report.studentsWithAbsence} alunos que faltaram`}
            </p>
          </div>
          {report.top.length === 0 ? (
            <p className="doc-muted">Nenhum aluno faltou no período.</p>
          ) : (
            <table className="doc-table doc-ranking">
              <thead>
                <tr>
                  <th scope="col" className="doc-num">
                    #
                  </th>
                  <th scope="col">Aluno(a)</th>
                  <th scope="col" className="doc-num">
                    Faltas
                  </th>
                  <th scope="col">Frequência</th>
                  <th scope="col" className="doc-num">
                    Seguidas
                  </th>
                  <th scope="col">Última falta</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {report.top.map((student, index) => (
                  <tr key={student.name}>
                    <td className="doc-num doc-rank">{index + 1}</td>
                    <td className="doc-month-name">{student.name}</td>
                    <td className="doc-num">
                      <strong>{student.absences}</strong>
                      <span className="doc-muted"> / {student.schoolDays}</span>
                    </td>
                    <td>
                      <span className="doc-bar">
                        <span className="doc-bar-track">
                          <span
                            className={`doc-bar-fill doc-risk-fill-${student.risk}`}
                            style={{ width: `${Math.round(student.presenceRate * 100)}%` }}
                          />
                        </span>
                        <span className="doc-bar-value">{formatPercent(student.presenceRate)}</span>
                      </span>
                    </td>
                    <td className="doc-num">{student.streak > 0 ? student.streak : "—"}</td>
                    <td>{student.lastAbsence ? formatDay(student.lastAbsence) : "—"}</td>
                    <td>
                      <span className={`doc-pill doc-risk-${student.risk}`}>{RISK_LABELS[student.risk]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="doc-muted doc-table-note">
            Faltas: total no período / dias de chamada. Frequência: dias presentes sobre os dias de chamada. Seguidas:
            faltas consecutivas até o último dia registrado.
          </p>
        </section>

        <DocumentFooter issuedBy={issuedBy} issuedOn={issuedOn} />
      </div>
    </div>,
    document.body,
  );
}
