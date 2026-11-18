import type { Classroom, GradeStudent } from "../../types/grade";
import type { SchoolIdentity } from "../../types/school";
import { formatDay } from "../../utils/attendance";
import { brDate, classDisplayName, formatScore } from "../../utils/grades";
import {
  evaluationLabel,
  LEVEL_LABELS,
  REPORT_LEVELS,
  type ReportCardData,
  type ReportLevel,
} from "../../utils/reportCard";

interface ReportCardSheetProps {
  student: GradeStudent;
  classroom: Classroom | null;
  report: ReportCardData;
  identity: SchoolIdentity;
  schoolYear: number;
  /** Dia da emissão (YYYY-MM-DD). */
  issuedOn: string;
}

/** Quanto do círculo da situação vem preenchido em cada nível (a legenda mostra os quatro). */
const LEVEL_FILL: Record<ReportLevel, number> = { developing: 0.25, satisfactory: 0.5, good: 0.75, excellent: 1 };

/** Círculo da situação: a parte preenchida cresce com o nível (legível também em preto e branco). */
function LevelCircle({ level, decorative = false }: { level: ReportLevel; decorative?: boolean }) {
  const fill = LEVEL_FILL[level];
  const r = 7;
  const angle = fill * 2 * Math.PI;
  const x = 8 + r * Math.sin(angle);
  const y = 8 - r * Math.cos(angle);
  const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": LEVEL_LABELS[level] };
  return (
    <svg viewBox="0 0 16 16" className="boletim-level" {...a11y}>
      <circle cx="8" cy="8" r={r} fill="#fff" stroke="#111" strokeWidth="1.2" />
      {fill >= 1 ? (
        <circle cx="8" cy="8" r={r} fill="#111" />
      ) : (
        <path d={`M8 8 L8 1 A${r} ${r} 0 ${fill > 0.5 ? 1 : 0} 1 ${x} ${y} Z`} fill="#111" />
      )}
    </svg>
  );
}

/** Evolução: as quatro médias ligadas por uma linha; bimestre sem nota fica vazado. */
function Evolution({ terms }: { terms: (number | null)[] }) {
  const xs = [8, 28, 48, 68];
  // Escala de 3 a 10: as médias quase nunca ficam abaixo disso, e meio ponto aparece.
  const yOf = (md: number) => 19 - ((Math.max(3, md) - 3) / 7) * 16;
  const points = terms
    .map((md, i) => (md === null ? null : { x: xs[i] ?? 0, y: yOf(md) }))
    .filter((p): p is { x: number; y: number } => p !== null);
  const lastIndex = terms.reduce<number>((last, md, i) => (md === null ? last : i), -1);
  return (
    <svg viewBox="0 0 76 22" className="boletim-evolution" aria-hidden="true">
      {points.length > 1 && (
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#9ca3af" strokeWidth="2" />
      )}
      {terms.map((md, i) =>
        md === null ? (
          <circle key={i} cx={xs[i]} cy={11} r={3} fill="#fff" stroke="#c4c8cf" strokeWidth="1.2" />
        ) : (
          <circle key={i} cx={xs[i]} cy={yOf(md)} r={4} fill={i === lastIndex ? "#111" : "#9ca3af"} />
        ),
      )}
    </svg>
  );
}

/** Uma cor por bimestre na pizza de faltas (distintas também impressas em tons de cinza). */
const TERM_COLORS = ["#1d4ed8", "#16a34a", "#f59e0b", "#dc2626"];

const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** Uma linha nos quatro bimestres (nota e, ao lado, as faltas) e o total de faltas. */
function TermCells({
  scores,
  absences,
  total,
}: {
  scores: (number | null)[];
  absences: (number | null)[];
  total: number | null;
}) {
  return (
    <>
      {scores.flatMap((md, i) => [
        <td key={`n${i}`} className="boletim-term-group">
          {md === null ? "" : formatScore(md)}
        </td>,
        <td key={`f${i}`} className="boletim-ft">
          {absences[i] ?? ""}
        </td>,
      ])}
      <td className="boletim-term-group boletim-ft boletim-ft-total">{total ?? ""}</td>
    </>
  );
}

/** Pizza das faltas: cada bimestre com a sua cor, do tamanho da parte dele no total. */
function AbsencePie({ shares, total }: { shares: number[]; total: number }) {
  const r = 16;
  let start = 0;
  const slices = shares.flatMap((share, i) => {
    if (share <= 0) return [];
    const from = start;
    start += share;
    if (share >= 0.9999) return [<circle key={i} cx="18" cy="18" r={r} fill={TERM_COLORS[i]} />];
    const point = (fraction: number) =>
      `${18 + r * Math.sin(fraction * 2 * Math.PI)} ${18 - r * Math.cos(fraction * 2 * Math.PI)}`;
    return [
      <path
        key={i}
        d={`M18 18 L${point(from)} A${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${point(start)} Z`}
        fill={TERM_COLORS[i]}
      />,
    ];
  });
  return (
    <svg viewBox="0 0 36 36" className="boletim-pie" role="img" aria-label={`Faltas por bimestre: ${total} no total`}>
      {total > 0 ? slices : <circle cx="18" cy="18" r={r} fill="#eceef1" />}
      <circle cx="18" cy="18" r="7.5" fill="#fff" />
      <text x="18" y="20.6" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#111">
        {total}
      </text>
    </svg>
  );
}

const Stars = () => (
  <span className="boletim-stars" aria-hidden="true">
    ☆☆☆☆☆
  </span>
);

const Dots = () => (
  <span className="boletim-dots" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((i) => (
      <span key={i} />
    ))}
  </span>
);

const PARTICIPATION = ["Participação em sala", "Realiza as atividades", "Interação e respeito", "Organização", "Autonomia"];
const DEVELOPMENT = ["Cognitivo", "Socioemocional", "Comunicação", "Criatividade", "Responsabilidade"];

/**
 * Boletim do aluno numa folha A4 em pé, no modelo "Acompanhamento do estudante". Médias e
 * faltas vêm do boletim da rede; o resto (participação, desenvolvimento, presenças,
 * observações) sai em branco para preencher à mão.
 */
export function ReportCardSheet({ student, classroom, report, identity, schoolYear, issuedOn }: ReportCardSheetProps) {
  const schoolName = identity.officialName || "Escola";
  const compact = report.subjects.length > 12;

  return (
    <article className={`boletim-sheet${compact ? " boletim-compact" : ""}`} aria-label={`Boletim de ${student.name}`}>
      <header className="boletim-head">
        <div className="boletim-badge">
          {identity.logoUrl ? <img src={identity.logoUrl} alt="" /> : null}
          <span>{schoolName}</span>
        </div>
        <div className="boletim-title">
          <h1>Boletim escolar</h1>
          <p>Acompanhamento do estudante</p>
        </div>
        <div className="boletim-year">
          <span>Ano letivo</span>
          <strong>{schoolYear}</strong>
        </div>
      </header>

      <section className="boletim-box">
        <h2 className="boletim-tab">Identificação do estudante</h2>
        <dl className="boletim-id">
          <div className="boletim-id-wide">
            <dt>Nome completo:</dt>
            <dd>
              {student.name}
              {student.notes ? ` - ${student.notes}` : ""}
              {student.transferred ? ` (TRF${student.transferredOn ? ` ${brDate(student.transferredOn)}` : ""})` : ""}
            </dd>
          </div>
          <div className="boletim-id-wide">
            <dt>Turma:</dt>
            <dd>
              {classroom ? `${classDisplayName(classroom.name)} · ${classroom.shift}` : student.className.toUpperCase()}
            </dd>
          </div>
          <div>
            <dt>Nº:</dt>
            <dd>{student.rollNumber ?? ""}</dd>
          </div>
          <div className="boletim-id-wide">
            <dt>Avaliação:</dt>
            <dd>{evaluationLabel(report.termsWithGrades)}</dd>
          </div>
          <div>
            <dt>Data:</dt>
            <dd>{formatDay(issuedOn)}</dd>
          </div>
        </dl>
      </section>

      <section className="boletim-box boletim-grades">
        <h2 className="boletim-tab">Desempenho por componentes curriculares</h2>
        <table>
          {/* Larguras pelas colunas: com a tabela fixa, a 2ª linha do cabeçalho não as define. */}
          <colgroup>
            <col className="boletim-col-subject" />
            {[1, 2, 3, 4].flatMap((term) => [
              <col key={`n${term}`} className="boletim-col-score" />,
              <col key={`f${term}`} className="boletim-col-ft" />,
            ])}
            <col className="boletim-col-total" />
            <col className="boletim-col-narrow" />
            <col className="boletim-col-narrow" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} scope="col" className="boletim-subject">
                Componentes curriculares
              </th>
              {/* Cada bimestre com a nota e, ao lado, as faltas da matéria. */}
              {[1, 2, 3, 4].map((term) => (
                <th key={term} colSpan={2} scope="colgroup" className="boletim-term-group">
                  {term}º bimestre
                </th>
              ))}
              <th rowSpan={2} scope="col" className="boletim-term-group boletim-ft">
                Total de faltas
              </th>
              <th rowSpan={2} scope="col" className="boletim-narrow">
                {report.complete ? "Média final" : "Média parcial"}
              </th>
              <th rowSpan={2} scope="col" className="boletim-narrow">
                Situação
              </th>
              <th rowSpan={2} scope="col">
                Evolução
              </th>
            </tr>
            <tr>
              {[1, 2, 3, 4].flatMap((term) => [
                <th key={`n${term}`} scope="col" className="boletim-term-group">
                  Nota
                </th>,
                <th key={`f${term}`} scope="col" className="boletim-ft">
                  Faltas
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {report.subjects.map((subject) => (
              <tr key={subject.name}>
                <th scope="row" className="boletim-subject">
                  {subject.name}
                </th>
                <TermCells scores={subject.terms} absences={subject.absences} total={subject.absenceTotal} />
                <td className="boletim-average">{subject.average === null ? "" : formatScore(subject.average)}</td>
                <td>{subject.level ? <LevelCircle level={subject.level} /> : <span className="boletim-none">—</span>}</td>
                <td>{subject.average === null ? "" : <Evolution terms={subject.terms} />}</td>
              </tr>
            ))}
            {report.activities && (
              <tr className="boletim-activities">
                <th scope="row" className="boletim-subject" title={report.activities.names.join(", ")}>
                  Atividades sem nota ({report.activities.names.length})
                </th>
                <TermCells
                  scores={[null, null, null, null]}
                  absences={report.activities.absences}
                  total={report.activities.absenceTotal}
                />
                <td colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="boletim-trio">
        <section className="boletim-card">
          <h2>Frequência</h2>
          <div className="boletim-frequency">
            <AbsencePie shares={report.absenceShares} total={report.absences} />
            <dl>
              {report.absencesByTerm.map((value, i) => (
                <div key={i}>
                  <dt>
                    <span className="boletim-swatch" style={{ background: TERM_COLORS[i] }} aria-hidden="true" />
                    {i + 1}º bim:
                  </dt>
                  <dd>
                    {value === null ? "–" : `${value} ${value === 1 ? "falta" : "faltas"}`}
                    {value !== null && report.absences > 0 && (
                      <span className="boletim-share"> ({percent(report.absenceShares[i] ?? 0)})</span>
                    )}
                  </dd>
                </div>
              ))}
              <div className="boletim-total">
                <dt>Total:</dt>
                <dd>
                  {report.absences} {report.absences === 1 ? "falta" : "faltas"}
                </dd>
              </div>
            </dl>
          </div>
        </section>
        <section className="boletim-card">
          <h2>Participação</h2>
          <ul>
            {PARTICIPATION.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <Stars />
              </li>
            ))}
          </ul>
        </section>
        <section className="boletim-card">
          <h2>Desenvolvimento</h2>
          <ul>
            {DEVELOPMENT.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <Dots />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="boletim-box boletim-notes">
        <h2>Observações da escola</h2>
        {[0, 1, 2, 3, 4].map((line) => (
          <span key={line} />
        ))}
      </section>

      <div className="boletim-legend">
        <strong>Legenda - Situação</strong>
        <ul>
          {REPORT_LEVELS.map((level) => (
            <li key={level}>
              <LevelCircle level={level} decorative />
              {LEVEL_LABELS[level]}
            </li>
          ))}
        </ul>
      </div>
      <p className="boletim-note boletim-scale">
        Em Desenvolvimento: média abaixo de 6,0 · Satisfatório: 6,0 a 7,9 · Bom: 8,0 a 8,9 · Excelente: 9,0 ou mais.
      </p>

      <footer className="boletim-signatures">
        <div>Assinatura da escola</div>
        <div>Assinatura do(a) responsável</div>
      </footer>
    </article>
  );
}
