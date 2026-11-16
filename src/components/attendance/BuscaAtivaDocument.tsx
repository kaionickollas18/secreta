import { createPortal } from "react-dom";
import { ALERT_FORM_PAGES, letterheadOf } from "../../constants/buscaAtiva";
import type { StudentReport } from "../../types/attendance";
import type { SchoolIdentity } from "../../types/school";
import type { StudentRecord } from "../../types/student";
import { formatDay } from "../../utils/attendance";
import { formatCep } from "../../utils/schoolIdentity";
import { absenceMonthsText, absencesText, alertNotes, fullAddress } from "../../utils/students";

interface BuscaAtivaDocumentProps {
  report: StudentReport;
  /** Cadastro do aluno; `null` quando ele não está no cadastro (os campos saem em branco). */
  student: StudentRecord | null;
  identity: SchoolIdentity;
  /** Dia em que o documento é emitido (YYYY-MM-DD). */
  issuedOn: string;
  /** Dia em que o responsável deve comparecer: o próximo dia de atendimento da escola (YYYY-MM-DD). */
  attendOn: string;
  /** Último dia de chamada considerado na contagem das faltas (YYYY-MM-DD). */
  countedUntil: string;
}

/** Texto escrito por cima de um campo do formulário. Vazio não escreve nada. */
function Field({ area, value }: { area: string; value: string }) {
  if (!value) return null;
  return (
    <p className={`busca-field busca-field-${area}${value.length > 38 ? " busca-field-long" : ""}`}>{value}</p>
  );
}

/**
 * Documento de busca ativa, em um único PDF (A4 em pé): o Formulário de Alerta da Busca Ativa
 * Escolar, com o que o sistema sabe do aluno já preenchido, e o termo de ciência e
 * responsabilidade no papel timbrado da escola. O que não há no cadastro fica em branco.
 */
export function BuscaAtivaDocument({
  report,
  student,
  identity,
  issuedOn,
  attendOn,
  countedUntil,
}: BuscaAtivaDocumentProps) {
  const letterhead = letterheadOf(identity.inep);
  const schoolName = identity.officialName || "escola";
  const months = absenceMonthsText(report.months);
  const address = student ? fullAddress(student) : "";

  return createPortal(
    <div className="print-document busca">
      <section className="busca-page" aria-label="Formulário de alerta, página 1">
        <img src={ALERT_FORM_PAGES[0]} alt="" className="busca-bg" />
        <Field area="name" value={student?.name ?? report.name.toUpperCase()} />
        <Field area="guardian" value={student?.guardianName ?? ""} />
        <Field area="birth" value={student?.birthDate ? formatDay(student.birthDate) : ""} />
        {student?.sex && <span className={`busca-check busca-check-${student.sex.toLowerCase()}`}>X</span>}
      </section>

      <section className="busca-page" aria-label="Formulário de alerta, página 2">
        <img src={ALERT_FORM_PAGES[1]} alt="" className="busca-bg" />
        <Field area="address" value={student?.address ?? ""} />
        <Field area="cep" value={student?.cep ? formatCep(student.cep) : ""} />
        <Field area="neighborhood" value={student?.neighborhood ?? ""} />
        <Field area="notes" value={alertNotes(report)} />
      </section>

      <section className="busca-page busca-term" aria-label="Termo de ciência e responsabilidade">
        {letterhead ? (
          <img src={letterhead} alt="" className="busca-bg" />
        ) : (
          <header className="busca-plain-header">
            {identity.logoUrl && <img src={identity.logoUrl} alt="" />}
            <div>
              <p className="busca-plain-name">{identity.officialName || "Escola"}</p>
              {identity.inep && <p>INEP {identity.inep}</p>}
              {identity.address && (
                <p>
                  {identity.address}
                  {identity.cep && ` · CEP ${formatCep(identity.cep)}`}
                </p>
              )}
            </div>
          </header>
        )}

        <div className="busca-term-body">
          <h1>Termo de ciência e responsabilidade aplicado aos pais ou responsáveis por alunos faltosos</h1>

          <dl className="busca-term-data">
            <div>
              <dt>Aluno:</dt>
              <dd>{student?.name ?? report.name.toUpperCase()}</dd>
            </div>
            <div className="busca-term-row">
              <div>
                <dt>Série:</dt>
                <dd>{report.className.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Data:</dt>
                <dd>{formatDay(issuedOn)}</dd>
              </div>
            </div>
            <div>
              <dt>Endereço:</dt>
              <dd>{address}</dd>
            </div>
          </dl>

          <ol>
            <li>
              <strong>COMUNICAMOS</strong> que o aluno supracitado vem apresentando, até a data{" "}
              <b>{formatDay(countedUntil)}</b>,
            </li>
            <li>
              {absencesText(report.absences)}
              {months && ` ${months}`}, ocasionando pouco desempenho nas atividades realizadas em sala de aula ou
              faltando a provas.
            </li>
            <li>
              <strong>SOLICITAMOS</strong> a sua presença nessa Unidade Escolar no <b>dia {formatDay(attendOn)}</b>,
              para que possamos averiguar a causa dessas faltas e assim
              justificá-las para melhor atender as necessidades do momento.
            </li>
            <li>
              <strong>DECLARO</strong>, para fins escolares, que fui comunicado pela {schoolName}
              {identity.address && `, localizada na ${identity.address}`}, através da gestão da escola
              {identity.principalName && `, na pessoa de ${identity.principalName}`}, quanto à evasão escolar do meu filho(a) e
              estou ciente da responsabilidade que me é conferida de acordo com o Capítulo IV, Artigos 53, 55 e 56 da
              Lei Federal 8.069 de 13 de julho de 1990, do Estatuto da Criança e do Adolescente – ECA.
            </li>
          </ol>

          <p className="busca-term-obs">OBS:</p>
          <ul>
            <li>
              A educação básica é obrigatória dos 4 aos 17 anos (Constituição Federal, art. 208, I), e os pais ou
              responsáveis têm a obrigação de matricular seus filhos na rede regular de ensino (ECA, art. 55, e LDB,
              art. 6º). Deixar a criança ou o adolescente fora da escola fere, portanto, seu direito à educação.
            </li>
            <li>
              O delito pelo qual os pais/responsáveis podem responder caso não tomem as iniciativas de matricular seus
              filhos na escola e garantir sua frequência é o de abandono intelectual (art. 246 do Código Penal, que
              estabelece pena de detenção de 15 dias a um mês ou multa).
            </li>
          </ul>

          <p className="busca-term-signature">
            Assinatura do Pai ou Responsável: <span />
          </p>
        </div>
      </section>
    </div>,
    document.body,
  );
}
