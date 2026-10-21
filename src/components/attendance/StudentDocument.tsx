import { createPortal } from "react-dom";
import type { RiskLevel, StudentReport } from "../../types/attendance";
import type { SchoolIdentity } from "../../types/school";
import { formatDay, formatPercent, RISK_LABELS } from "../../utils/attendance";
import {
  CHART_BOX,
  monthHighlights,
  monthTitle,
  periodText,
  presenceChart,
  spansYears,
} from "../../utils/reportChart";
import { DocumentFooter } from "./DocumentFooter";
import { DocumentHeader } from "./DocumentHeader";


interface StudentDocumentProps {
  report: StudentReport;
  identity: SchoolIdentity;
  /** Nome de quem emite (vai no rodapé). */
  issuedBy: string;
  /** Data de emissão (YYYY-MM-DD). */
  issuedOn: string;
}

/** Medidor circular da frequência do período, na cor da situação. */
function Gauge({ value, risk }: { value: number; risk: RiskLevel }) {
  // Circunferência 100: o traço colorido mede exatamente a porcentagem.
  const filled = Math.max(0, Math.min(100, value * 100));
  return (
    <svg viewBox="0 0 36 36" className="doc-gauge-svg">
      <circle cx="18" cy="18" r="15.9155" className="doc-gauge-track" />
      <circle
        cx="18"
        cy="18"
        r="15.9155"
        className={`doc-gauge-value doc-risk-stroke-${risk}`}
        strokeDasharray={`${filled} ${100 - filled}`}
        strokeDashoffset="25"
      />
      <text x="18" y="19.6" textAnchor="middle" className="doc-gauge-number">
        {formatPercent(value)}
      </text>
      <text x="18" y="24.4" textAnchor="middle" className="doc-gauge-caption">
        presença
      </text>
    </svg>
  );
}

/** Frequência mês a mês, com as faixas de atenção e crítico tracejadas. */
function PresenceChart({ report }: { report: StudentReport }) {
  const chart = presenceChart(report.months);
  const { width, height, left, right } = CHART_BOX;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="doc-chart-svg">
      <defs>
        <linearGradient id="doc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4F7BE8" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#4F7BE8" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {chart.ticks.map((tick) => (
        <g key={tick.label}>
          <line
            x1={left}
            x2={width - right}
            y1={tick.y}
            y2={tick.y}
            className="doc-chart-grid"
          />
          <text x={left - 8} y={tick.y + 4} textAnchor="end" className="doc-chart-axis">
            {tick.label}
          </text>
        </g>
      ))}
      {chart.limits.map((limit) => (
        <g key={limit.label}>
          <line
            x1={left}
            x2={width - right}
            y1={limit.y}
            y2={limit.y}
            className={`doc-chart-limit doc-chart-limit-${limit.label === "Crítico" ? "critical" : "warning"}`}
          />
          <text x={width - right + 6} y={limit.y + 4} className="doc-chart-limit-label">
            {limit.label}
          </text>
        </g>
      ))}
      {chart.points.length > 1 && <path d={chart.area} fill="url(#doc-area)" />}
      {chart.points.length > 1 && <path d={chart.line} className="doc-chart-line" />}
      {chart.points.map((point) => (
        <g key={`${point.label}-${point.x}`}>
          <circle
            cx={point.x}
            cy={point.y}
            r="5.5"
            className={`doc-chart-dot doc-risk-stroke-${point.risk}`}
          />
          <text
            x={point.x}
            y={point.y - 11}
            textAnchor="middle"
            className="doc-chart-value"
          >
            {formatPercent(point.value)}
          </text>
          <text x={point.x} y={height - 8} textAnchor="middle" className="doc-chart-axis">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Relatório de frequência do aluno em formato de documento oficial: A4 deitado, fundo branco,
 * cartões claros, gráfico mês a mês e a logo da escola em marca-d'água. Fica fora da tela e só
 * aparece na impressão, de onde o navegador salva em PDF. Estilos em `index.css` (`.doc-*`).
 */
export function StudentDocument({
  report,
  identity,
  issuedBy,
  issuedOn,
}: StudentDocumentProps) {
  const presences = report.schoolDays - report.absences;
  const withYear = spansYears(report.months);
  const highlights = monthHighlights(report.months);
  const period = periodText(report.months);

  return createPortal(
    <div className="print-document doc" aria-hidden="true">
      {identity.logoUrl && (
        <img src={identity.logoUrl} alt="" className="print-watermark" />
      )}

      <DocumentHeader identity={identity} title="Relatório de Frequência do Aluno" issuedOn={issuedOn} />

      <section className="doc-kpis">
        <div className="doc-card doc-student">
          <span className="doc-pill">Aluno(a)</span>
          <p className="doc-student-name">{report.name}</p>
          <p className="doc-student-class">
            Turma <strong>{report.className}</strong>
            {period && (
              <>
                {" "}
                · Período: <strong>{period}</strong>
              </>
            )}
          </p>
          <span className={`doc-pill doc-risk-${report.risk}`}>
            Situação: {RISK_LABELS[report.risk]}
          </span>
        </div>

        <div className="doc-card doc-gauge">
          <Gauge value={report.presenceRate} risk={report.risk} />
          <div>
            <p className="doc-kpi-label">Frequência no período</p>
            <p className="doc-kpi-sub">
              {presences} de {report.schoolDays}{" "}
              {report.schoolDays === 1 ? "dia" : "dias"} presente
            </p>
          </div>
        </div>

        <div className="doc-card doc-kpi">
          <p className="doc-kpi-label">Faltas</p>
          <p className="doc-kpi-value">{report.absences}</p>
          <p className="doc-kpi-sub">
            {report.absences} em {report.schoolDays}{" "}
            {report.schoolDays === 1 ? "dia" : "dias"} de chamada
          </p>
        </div>

        <div className="doc-card doc-kpi">
          <p className="doc-kpi-label">Última falta</p>
          <p className="doc-kpi-value doc-kpi-value-date">
            {report.lastAbsence ? formatDay(report.lastAbsence) : "—"}
          </p>
          <p className="doc-kpi-sub">
            {!report.lastAbsence
              ? "Nenhuma falta no período"
              : report.streak > 1
                ? `${report.streak} faltas seguidas até o último dia registrado`
                : "Falta mais recente registrada"}
          </p>
        </div>
      </section>

      {/* Gráfico e tabela empilhados na largura toda: o documento cresce para baixo e, se
          precisar, a tabela continua na página seguinte (com o cabeçalho das colunas). */}
      <section className="doc-card doc-chart">
        <div className="doc-chart-body">
          <div className="doc-chart-plot">
            <div className="doc-card-head">
              <h2 className="doc-section-title">Frequência mês a mês</h2>
              <p className="doc-legend">
                <span className="doc-legend-item">
                  <span className="doc-legend-line" />
                  Frequência
                </span>
                <span className="doc-legend-item">
                  <span className="doc-legend-dash doc-legend-dash-warning" />
                  Atenção (85%)
                </span>
                <span className="doc-legend-item">
                  <span className="doc-legend-dash doc-legend-dash-critical" />
                  Crítico (75%)
                </span>
              </p>
            </div>
            <PresenceChart report={report} />
          </div>
          <div className="doc-facts">
            {highlights.best && (
              <div className="doc-fact">
                <p className="doc-kpi-label">Melhor mês</p>
                <p className="doc-fact-value">
                  {monthTitle(highlights.best.month, withYear)} ·{" "}
                  {formatPercent(highlights.best.presenceRate)}
                </p>
              </div>
            )}
            {highlights.worst && (
              <div className="doc-fact">
                <p className="doc-kpi-label">Menor frequência</p>
                <p className="doc-fact-value">
                  {monthTitle(highlights.worst.month, withYear)} ·{" "}
                  {formatPercent(highlights.worst.presenceRate)}
                </p>
              </div>
            )}
            <div className="doc-fact">
              <p className="doc-kpi-label">Meses regulares</p>
              <p className="doc-fact-value">
                {highlights.regular} de {highlights.total}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="doc-card doc-months">
        <h2 className="doc-section-title">Detalhe por mês</h2>
        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col" className="doc-num">
                Dias
              </th>
              <th scope="col" className="doc-num">
                Faltas
              </th>
              <th scope="col">Frequência</th>
              <th scope="col">Dias com falta</th>
            </tr>
          </thead>
          <tbody>
            {report.months.map((month) => (
              <tr key={month.month}>
                <td className="doc-month-name">{monthTitle(month.month, withYear)}</td>
                <td className="doc-num">{month.schoolDays}</td>
                <td className="doc-num">{month.absences}</td>
                <td>
                  <span className="doc-bar">
                    <span className="doc-bar-track">
                      <span
                        className={`doc-bar-fill doc-risk-fill-${month.risk}`}
                        style={{ width: `${Math.round(month.presenceRate * 100)}%` }}
                      />
                    </span>
                    <span className="doc-bar-value">
                      {formatPercent(month.presenceRate)}
                    </span>
                  </span>
                </td>
                {/* Só o dia: o mês já está na linha. */}
                <td className="doc-month-dates">
                  {month.dates.length > 0
                    ? month.dates.map((date) => date.slice(8, 10)).join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <DocumentFooter issuedBy={issuedBy} issuedOn={issuedOn} />
    </div>,
    document.body,
  );
}
