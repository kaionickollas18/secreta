import { useMemo } from "react";
import { createPortal } from "react-dom";
import { MATRIX_LABELS, SUBJECT_LABELS } from "../../constants/descriptors";
import type { AnswerSheet, Assessment } from "../../types/assessment";
import { LEVEL_LABELS } from "../../utils/assessmentAnalytics";
import {
  descriptorsSheet,
  exportFileName,
  questionsSheet,
  responsesSheet,
  studentsSheet,
  toCsv,
} from "../../utils/assessmentExport";
import { formatPercent } from "../../utils/assessments";
import { buildPedagogicalReport, type PedagogicalReport, type StudentFocus } from "../../utils/pedagogicalReport";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { DownloadIcon } from "../ui/Icons";

interface PedagogicalReportViewProps {
  assessment: Assessment;
  sheets: readonly AnswerSheet[];
  assessments: readonly Assessment[];
  sheetsOf: (assessmentId: string) => readonly AnswerSheet[];
  schoolName: string;
}

function downloadCsv(content: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const today = () => new Date().toLocaleDateString("pt-BR");

/**
 * Devolutiva pedagógica para o professor regente: o que retomar, com quem e como. A mesma
 * página sai na impressão (A4 em pé) e as planilhas trazem todos os dados para a escola cruzar.
 */
export function PedagogicalReportView({ assessment, sheets, assessments, sheetsOf, schoolName }: PedagogicalReportViewProps) {
  const report = useMemo(
    () => buildPedagogicalReport(assessment, sheets, assessments, sheetsOf),
    [assessment, sheets, assessments, sheetsOf],
  );

  if (sheets.length === 0) {
    return (
      <EmptyState
        title="A devolutiva aparece depois da correção"
        description="Corrija os cartões da turma na aba Correção. A devolutiva para o professor é montada na hora, com os dados da turma."
      />
    );
  }

  const exports = [
    { label: "Por aluno", part: "alunos", rows: () => studentsSheet(assessment, sheets) },
    { label: "Por descritor", part: "descritores", rows: () => descriptorsSheet(assessment, sheets) },
    { label: "Por questão", part: "questoes", rows: () => questionsSheet(assessment, sheets) },
    { label: "Dados completos", part: "respostas", rows: () => responsesSheet(assessment, sheets) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="devolutiva-acoes" className="glass flex flex-col gap-3 rounded-2xl p-4">
        <h2 id="devolutiva-acoes" className="section-title">
          Entregar ao professor
        </h2>
        <p className="caption">
          Imprima ou salve em PDF para entregar ao professor regente. As planilhas trazem todos os dados da correção
          (abrem no Excel e no Google Planilhas); "Dados completos" tem uma linha por resposta, pronta para tabela
          dinâmica e para juntar várias avaliações.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="primary" onClick={() => window.print()}>
            Imprimir ou salvar em PDF
          </Button>
          {exports.map((item) => (
            <Button
              key={item.part}
              variant="secondary"
              onClick={() => downloadCsv(toCsv(item.rows()), exportFileName(assessment, item.part))}
            >
              <DownloadIcon /> {item.label}
            </Button>
          ))}
        </div>
      </section>

      <article aria-label="Devolutiva pedagógica" className="glass rounded-2xl p-5 sm:p-7">
        <ReportBody report={report} assessment={assessment} schoolName={schoolName} />
      </article>

      {createPortal(
        <div className="print-document devolutiva-print" aria-hidden="true">
          <ReportBody report={report} assessment={assessment} schoolName={schoolName} />
        </div>,
        document.body,
      )}
    </div>
  );
}

const LEVEL_BADGE = {
  critical: "bg-prio-urgent-tint text-prio-urgent",
  developing: "bg-prio-medium-tint text-prio-medium",
  consolidated: "bg-prio-low-tint text-prio-low",
} as const;

function ReportBody({ report, assessment, schoolName }: { report: PedagogicalReport; assessment: Assessment; schoolName: string }) {
  const { summary, priorities, groups } = report;
  return (
    <div className="devolutiva flex flex-col gap-6 text-sm leading-relaxed">
      <header className="flex flex-col gap-1 border-b border-line pb-4">
        {schoolName && <p className="text-xs font-semibold uppercase tracking-wide text-muted">{schoolName}</p>}
        <h2 className="text-2xl font-bold leading-tight tracking-tight">{report.title}</h2>
        <p className="text-muted">{report.subtitle}</p>
        <p className="text-muted">
          Para: professor(a) regente de {SUBJECT_LABELS[assessment.subject]} · Matriz: {MATRIX_LABELS[assessment.matrix]} ·
          Emitida em {today()}
        </p>
      </header>

      <section aria-labelledby="dv-leitura" className="flex flex-col gap-3">
        <h3 id="dv-leitura" className="section-title">
          1. Leitura geral da turma
        </h3>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Média de acertos", formatPercent(summary.mean)],
            ["Mediana", formatPercent(summary.median)],
            ["Corrigidos", `${summary.applied}${summary.rosterSize ? `/${summary.rosterSize}` : ""}`],
            ["Situação crítica", String(groups.critical.length)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line px-3 py-2">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-xl font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {report.overview.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </section>

      <section aria-labelledby="dv-prioridades" className="flex flex-col gap-3">
        <h3 id="dv-prioridades" className="section-title">
          2. O que retomar primeiro
        </h3>
        {priorities.length === 0 ? (
          <p>Nenhum descritor ficou abaixo de 70% de acerto na turma.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {priorities.map((p) => (
              <li key={p.stat.descriptor.code} className="devolutiva-card flex flex-col gap-2 rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Prioridade {p.rank}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${LEVEL_BADGE[p.stat.level]}`}
                  >
                    {LEVEL_LABELS[p.stat.level]} · {formatPercent(p.stat.hitRate)} de acerto
                  </span>
                </div>
                <p className="font-semibold">
                  {p.stat.descriptor.code} — {p.stat.descriptor.text || "descritor sem descrição"}
                </p>
                <p className="text-muted">
                  {p.stat.descriptor.topic ? `${p.stat.descriptor.topic} · ` : ""}
                  {p.stat.questions.length === 1 ? "Questão" : "Questões"} {p.stat.questions.join(", ")} ·{" "}
                  {p.stat.correct} de {p.stat.attempts} respostas certas
                </p>
                {p.distractors.length > 0 && (
                  <p>
                    <strong>Onde a turma errou: </strong>
                    {p.distractors
                      .map(
                        (d) =>
                          `na questão ${d.question}, ${formatPercent(d.share)} marcaram ${d.choice} (o certo era ${d.key})`,
                      )
                      .join("; ")}
                    . Vale discutir por que essa alternativa pareceu correta.
                  </p>
                )}
                <div>
                  <p>
                    <strong>Como trabalhar ({p.tip.focus.toLowerCase()}):</strong>
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {p.tip.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
                <p>
                  <strong>
                    Com quem ({p.students.length} {p.students.length === 1 ? "aluno" : "alunos"}):
                  </strong>{" "}
                  {p.students.length === 0 ? "nenhum aluno abaixo de 50% neste descritor." : p.students.join(", ")}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="dv-alunos" className="flex flex-col gap-3">
        <h3 id="dv-alunos" className="section-title">
          3. Alunos: onde cada um precisa de apoio
        </h3>
        <div className="grid gap-4 lg:grid-cols-3">
          <StudentGroup
            title="Atenção imediata"
            hint={`abaixo de ${formatPercent(assessment.criticalThreshold)} de acerto`}
            students={groups.critical}
            tone="text-prio-urgent"
            showGaps
          />
          <StudentGroup title="Em desenvolvimento" hint="precisam de retomada pontual" students={groups.developing} tone="text-prio-medium" showGaps />
          <StudentGroup title="Podem ser monitores" hint="70% ou mais de acerto" students={groups.advanced} tone="text-prio-low" />
        </div>
      </section>

      {report.questionsToRevisit.length > 0 && (
        <section aria-labelledby="dv-questoes" className="flex flex-col gap-3">
          <h3 id="dv-questoes" className="section-title">
            4. Questões para corrigir com a turma
          </h3>
          <ul className="flex flex-col gap-1.5">
            {report.questionsToRevisit.map((q) => (
              <li key={q.number}>
                <strong>Questão {q.number}</strong> ({q.descriptors.map((d) => d.code).join(", ") || "sem descritor"}):{" "}
                {formatPercent(q.errorRate)} erraram; gabarito {q.key}
                {q.topDistractor
                  ? `, a alternativa errada mais marcada foi ${q.topDistractor.choice} (${formatPercent(q.topDistractor.share)})`
                  : ""}
                {q.blank > 0 ? `; ${q.blank} em branco` : ""}.
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="dv-fortes" className="flex flex-col gap-3">
        <h3 id="dv-fortes" className="section-title">
          {report.questionsToRevisit.length > 0 ? "5" : "4"}. O que a turma já domina
        </h3>
        {report.strengths.length === 0 ? (
          <p>Nenhum descritor chegou a 70% de acerto ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {report.strengths.map((d) => (
              <li key={d.descriptor.code}>
                <strong>{d.descriptor.code}</strong> ({formatPercent(d.hitRate)}) {d.descriptor.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dv-encaminhamentos" className="flex flex-col gap-3">
        <h3 id="dv-encaminhamentos" className="section-title">
          {report.questionsToRevisit.length > 0 ? "6" : "5"}. Encaminhamentos
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5">
          {report.nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-line pt-3 text-xs text-muted">
        {report.untagged.length > 0 && (
          <p>
            Questões sem descritor ({report.untagged.join(", ")}) entram na nota, mas não na análise por habilidade.
          </p>
        )}
        <p>
          Gerado pelo SECRETA a partir de {summary.applied} cartões corrigidos. As sugestões de intervenção são pontos de
          partida: adapte-as à turma e ao material disponível.
        </p>
        {/* Assinaturas: só no papel. */}
        <div className="mt-12 hidden grid-cols-2 gap-12 text-center print:grid">
          <p className="border-t border-ink pt-1">Coordenação pedagógica</p>
          <p className="border-t border-ink pt-1">Professor(a) regente</p>
        </div>
      </footer>
    </div>
  );
}

interface StudentGroupProps {
  title: string;
  hint: string;
  students: StudentFocus[];
  tone: string;
  showGaps?: boolean;
}

function StudentGroup({ title, hint, students, tone, showGaps = false }: StudentGroupProps) {
  return (
    <div className="devolutiva-card flex flex-col gap-2 rounded-xl border border-line p-4">
      <p className={`font-semibold ${tone}`}>
        {title} ({students.length})
      </p>
      <p className="text-xs text-muted">{hint}</p>
      {students.length === 0 ? (
        <p className="text-muted">Nenhum aluno.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {students.map((s) => (
            <li key={s.slot}>
              <span className="font-semibold">{s.name}</span>{" "}
              <span className="tabular-nums text-muted">
                {formatPercent(s.percent)} ({s.correct}/{s.scored}
                {s.blank ? `, ${s.blank} em branco` : ""})
              </span>
              {showGaps && s.gaps.length > 0 && (
                <span className="block text-xs text-muted">Reforçar: {s.gaps.join(", ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
