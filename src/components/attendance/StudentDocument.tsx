import { createPortal } from "react-dom";
import type { RiskLevel, StudentReport } from "../../types/attendance";
import type { SchoolIdentity } from "../../types/school";
import { formatDay, formatPercent } from "../../utils/attendance";
import { formatCep } from "../../utils/schoolIdentity";

const RISK_TEXT: Record<RiskLevel, string> = {
  ok: "Regular",
  warning: "Atenção",
  critical: "Crítico",
};

interface StudentDocumentProps {
  report: StudentReport;
  identity: SchoolIdentity;
  /** Nome de quem emite (vai no rodapé). */
  issuedBy: string;
  /** Data de emissão (YYYY-MM-DD). */
  issuedOn: string;
}

const CELL = "border border-black/60 px-2 py-1";

/**
 * Relatório de frequência do aluno em formato de documento oficial (A4, fundo branco, logo
 * da escola em marca-d'água). Fica fora da tela e só aparece na impressão, de onde o
 * navegador salva em PDF. As regras de impressão estão em `index.css` (`.print-document`).
 */
export function StudentDocument({ report, identity, issuedBy, issuedOn }: StudentDocumentProps) {
  // Duas linhas sob o nome: a identificação legal e, abaixo, onde a escola fica.
  const legal = [identity.inep && `INEP: ${identity.inep}`, identity.decree].filter(Boolean).join(" · ");
  const place = [identity.address, identity.cep && `CEP: ${formatCep(identity.cep)}`].filter(Boolean).join(" · ");

  return createPortal(
    <div className="print-document" aria-hidden="true">
      {identity.logoUrl && <img src={identity.logoUrl} alt="" className="print-watermark" />}

      <header className="flex items-center gap-4 border-b-2 border-black pb-3">
        {identity.logoUrl && <img src={identity.logoUrl} alt="" className="h-[26mm] w-[26mm] object-contain" />}
        <div className="flex-1 text-center">
          <p className="text-[13pt] font-bold uppercase leading-tight">{identity.officialName || "Escola"}</p>
          {legal && <p className="mt-1 text-[9pt] leading-snug">{legal}</p>}
          {place && <p className="text-[9pt] leading-snug">{place}</p>}
        </div>
        {/* Espaço igual ao da logo, para o texto ficar centrado na página. */}
        {identity.logoUrl && <span className="w-[26mm]" />}
      </header>

      <h1 className="mt-6 text-center text-[14pt] font-bold uppercase tracking-wide">
        Relatório de Frequência do Aluno
      </h1>

      <table className="mt-5 w-full border-collapse text-[11pt]">
        <tbody>
          <tr>
            <th scope="row" className={`${CELL} w-[32%] text-left font-semibold`}>
              Aluno(a)
            </th>
            <td className={`${CELL} font-semibold uppercase`}>{report.name}</td>
          </tr>
          <tr>
            <th scope="row" className={`${CELL} text-left font-semibold`}>
              Turma
            </th>
            <td className={CELL}>{report.className}</td>
          </tr>
          <tr>
            <th scope="row" className={`${CELL} text-left font-semibold`}>
              Frequência no período
            </th>
            <td className={CELL}>
              {formatPercent(report.presenceRate)} ({RISK_TEXT[report.risk]})
            </td>
          </tr>
          <tr>
            <th scope="row" className={`${CELL} text-left font-semibold`}>
              Faltas
            </th>
            <td className={CELL}>
              {report.absences} em {report.schoolDays} {report.schoolDays === 1 ? "dia" : "dias"} de chamada
            </td>
          </tr>
          <tr>
            <th scope="row" className={`${CELL} text-left font-semibold`}>
              Última falta registrada
            </th>
            <td className={CELL}>{report.lastAbsence ? formatDay(report.lastAbsence) : "—"}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="mt-6 text-[11pt] font-bold uppercase">Frequência por mês</h2>
      <table className="mt-2 w-full border-collapse text-[10pt]">
        <thead>
          <tr className="bg-black/10">
            <th scope="col" className={`${CELL} text-left`}>
              Mês
            </th>
            <th scope="col" className={`${CELL} text-center`}>
              Dias de chamada
            </th>
            <th scope="col" className={`${CELL} text-center`}>
              Faltas
            </th>
            <th scope="col" className={`${CELL} text-center`}>
              Frequência
            </th>
            <th scope="col" className={`${CELL} text-left`}>
              Dias das faltas
            </th>
          </tr>
        </thead>
        <tbody>
          {report.months.map((month) => (
            <tr key={month.month} className="break-inside-avoid">
              <td className={`${CELL} first-letter:uppercase`}>{month.label}</td>
              <td className={`${CELL} text-center`}>{month.schoolDays}</td>
              <td className={`${CELL} text-center`}>{month.absences}</td>
              <td className={`${CELL} text-center`}>{formatPercent(month.presenceRate)}</td>
              <td className={CELL}>
                {month.dates.length > 0 ? month.dates.map((date) => formatDay(date).slice(0, 5)).join(", ") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-[8.5pt] leading-snug">
        A frequência considera os dias de chamada registrados para a turma no período. Situação: Regular, até 15% de
        faltas; Atenção, de 15% a 25%; Crítico, mais de 25%.
      </p>

      <footer className="mt-12 break-inside-avoid text-[10pt]">
        <p>
          Emitido em {formatDay(issuedOn)} por {issuedBy}.
        </p>
        <div className="mx-auto mt-16 w-[80mm] border-t border-black pt-1 text-center">
          <p>Secretaria Escolar</p>
          <p className="text-[8.5pt]">Assinatura e carimbo</p>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
