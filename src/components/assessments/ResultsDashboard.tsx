import { useMemo, useState } from "react";
import { MATRIX_LABELS, SUBJECT_LABELS } from "../../constants/descriptors";
import type { AnswerSheet, Assessment } from "../../types/assessment";
import {
  classHistory,
  classSummary,
  descriptorStats,
  LEVEL_LABELS,
  questionStats,
  studentResults,
  type DescriptorLevel,
  type StudentResult,
} from "../../utils/assessmentAnalytics";
import { formatPercent } from "../../utils/assessments";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { StudentSheetModal } from "./StudentSheetModal";

interface ResultsDashboardProps {
  assessment: Assessment;
  sheets: readonly AnswerSheet[];
  /** Todas as avaliações da escola (para o comparativo da turma). */
  assessments: readonly Assessment[];
  sheetsOf: (assessmentId: string) => readonly AnswerSheet[];
  onThresholdChange: (threshold: number) => void;
}

const LEVEL_STYLE: Record<DescriptorLevel, { bar: string; badge: string; icon: string }> = {
  critical: { bar: "bg-prio-urgent", badge: "bg-prio-urgent-tint text-prio-urgent", icon: "▼" },
  developing: { bar: "bg-prio-medium", badge: "bg-prio-medium-tint text-prio-medium", icon: "■" },
  consolidated: { bar: "bg-prio-low", badge: "bg-prio-low-tint text-prio-low", icon: "▲" },
};

/** Barra horizontal fina (um valor de 0 a 1), com a ponta arredondada. */
function Meter({ value, className, label }: { value: number; className: string; label: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-raised" role="img" aria-label={label} title={label}>
      <div
        className={`h-full animate-bar rounded-full ${className}`}
        style={{ width: `${Math.max(value > 0 ? 2 : 0, value * 100)}%`, transformOrigin: "left" }}
      />
    </div>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="glass flex flex-col gap-1 rounded-2xl p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-[1.75rem] font-bold leading-none tracking-tight tabular-nums">{value}</p>
      {detail && <p className="caption">{detail}</p>}
    </div>
  );
}

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

/** Resultados da turma: desempenho geral, questões, descritores e alunos em situação crítica. */
export function ResultsDashboard({ assessment, sheets, assessments, sheetsOf, onThresholdChange }: ResultsDashboardProps) {
  const [openStudent, setOpenStudent] = useState<StudentResult | null>(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [showAllStudents, setShowAllStudents] = useState(false);

  const summary = useMemo(() => classSummary(assessment, sheets), [assessment, sheets]);
  const questions = useMemo(() => questionStats(assessment, sheets), [assessment, sheets]);
  const descriptors = useMemo(() => descriptorStats(assessment, sheets), [assessment, sheets]);
  const students = useMemo(() => studentResults(assessment, sheets), [assessment, sheets]);
  const history = useMemo(() => classHistory(assessment, assessments, sheetsOf), [assessment, assessments, sheetsOf]);
  const critical = students.filter((s) => s.critical);

  if (sheets.length === 0) {
    return (
      <EmptyState
        title="Ainda não há cartões corrigidos"
        description="Corrija os cartões da turma na aba Correção: os resultados aparecem aqui na hora."
      />
    );
  }

  const shownQuestions = showAllQuestions ? questions : questions.slice(0, 8);
  const ranges = ["0–24%", "25–49%", "50–74%", "75–100%"];
  const maxRange = Math.max(1, ...summary.distribution);
  const previous = history.filter((h) => h.assessmentId !== assessment.id);
  const before = [...previous].reverse().find((h) => h.date <= assessment.date);

  return (
    <div className="flex flex-col gap-5">
      <p className="caption">
        {SUBJECT_LABELS[assessment.subject]} · Turma {assessment.className} · {MATRIX_LABELS[assessment.matrix]} ·{" "}
        {summary.scoredQuestions} questões válidas
      </p>

      <section aria-label="Desempenho geral" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile
          label="Média de acertos"
          value={formatPercent(summary.mean)}
          detail={`${summary.meanCorrect.toFixed(1).replace(".", ",")} de ${summary.scoredQuestions} questões`}
        />
        <Tile label="Taxa de acerto" value={formatPercent(summary.hitRate)} detail={`mediana ${formatPercent(summary.median)}`} />
        <Tile
          label="Taxa de erro"
          value={formatPercent(summary.errorRate)}
          detail={summary.blankRate > 0 ? `${formatPercent(summary.blankRate)} em branco` : "nenhuma em branco"}
        />
        <Tile
          label="Corrigidos"
          value={`${summary.applied}/${summary.rosterSize || summary.applied}`}
          detail={summary.missing.length ? `${summary.missing.length} sem cartão` : "turma completa"}
        />
        <Tile
          label="Situação crítica"
          value={String(summary.belowThreshold)}
          detail={`abaixo de ${formatPercent(assessment.criticalThreshold)}`}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="res-faixas" className="glass flex flex-col gap-3 rounded-2xl p-4">
          <h2 id="res-faixas" className="section-title">
            Alunos por faixa de acerto
          </h2>
          <ul className="flex flex-col gap-2">
            {summary.distribution.map((count, i) => (
              <li key={ranges[i]} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 text-sm">
                <span className="text-muted">{ranges[i]}</span>
                <Meter value={count / maxRange} className="bg-accent" label={`${ranges[i]}: ${count} alunos`} />
                <span className="text-right font-semibold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="res-comparativo" className="glass flex flex-col gap-3 rounded-2xl p-4">
          <h2 id="res-comparativo" className="section-title">
            Evolução da turma em {SUBJECT_LABELS[assessment.subject]}
          </h2>
          {previous.length === 0 ? (
            <p className="caption">
              Esta é a primeira avaliação corrigida da turma nesta disciplina. O comparativo aparece quando houver outras.
            </p>
          ) : (
            <>
              {before && (
                <p className="text-sm">
                  {summary.mean >= before.mean ? "Subiu" : "Caiu"}{" "}
                  <strong className="tabular-nums">
                    {Math.abs(Math.round((summary.mean - before.mean) * 100))} pontos
                  </strong>{" "}
                  em relação a "{before.title}" ({formatPercent(before.mean)}).
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {history.map((h) => (
                  <li key={h.assessmentId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_2.5rem] items-center gap-3 text-sm">
                    <span className={`truncate ${h.assessmentId === assessment.id ? "font-semibold" : "text-muted"}`}>
                      {shortDate(h.date)} · {h.title}
                    </span>
                    <Meter
                      value={h.mean}
                      className={h.assessmentId === assessment.id ? "bg-accent" : "bg-muted/60"}
                      label={`${h.title}: média ${formatPercent(h.mean)}`}
                    />
                    <span className="text-right font-semibold tabular-nums">{formatPercent(h.mean)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="res-questoes" className="glass flex flex-col gap-3 rounded-2xl p-4">
        <h2 id="res-questoes" className="section-title">
          Questões mais erradas
        </h2>
        {/* Celular: uma questão por bloco, sem rolar de lado. */}
        <ol aria-label="Questões mais erradas" className="flex flex-col divide-y divide-line sm:hidden">
          {shownQuestions.map((q) => (
            <li key={q.number} className="flex flex-col gap-1.5 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-bold">Questão {q.number}</span>
                <span className="ml-auto font-semibold tabular-nums">{formatPercent(q.errorRate)} de erro</span>
              </div>
              <Meter value={q.errorRate} className="bg-prio-urgent" label={`Questão ${q.number}: ${formatPercent(q.errorRate)} de erro`} />
              <p className="text-muted">
                Gabarito <strong className="text-ink">{q.key}</strong>
                {q.topDistractor && (
                  <>
                    {" "}· mais marcada errada <strong className="text-ink">{q.topDistractor.choice}</strong> ({formatPercent(q.topDistractor.share)})
                  </>
                )}
                {q.blank > 0 && ` · ${q.blank} em branco`}
              </p>
              {q.descriptors.map((d) => (
                <p key={d.code}>
                  <strong>{d.code}</strong> <span className="text-muted">{d.text}</span>
                </p>
              ))}
            </li>
          ))}
        </ol>
        <div className="-mx-4 hidden overflow-x-auto px-4 sm:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Questão
                </th>
                <th scope="col" className="w-48 py-2 pr-3 font-medium">
                  Erro
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Gabarito
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Distrator mais marcado
                </th>
                <th scope="col" className="py-2 font-medium">
                  Descritor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shownQuestions.map((q) => (
                <tr key={q.number}>
                  <th scope="row" className="py-2 pr-3 font-bold tabular-nums">
                    {q.number}
                  </th>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <Meter value={q.errorRate} className="bg-prio-urgent" label={`Questão ${q.number}: ${formatPercent(q.errorRate)} de erro`} />
                      <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{formatPercent(q.errorRate)}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 font-semibold">{q.key}</td>
                  <td className="py-2 pr-3">
                    {q.topDistractor ? (
                      <>
                        <strong>{q.topDistractor.choice}</strong>{" "}
                        <span className="text-muted">({formatPercent(q.topDistractor.share)} da turma)</span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    {q.blank > 0 && <span className="block text-xs text-muted">{q.blank} em branco</span>}
                  </td>
                  <td className="py-2">
                    {q.descriptors.length === 0 ? (
                      <span className="text-muted">sem descritor</span>
                    ) : (
                      q.descriptors.map((d) => (
                        <span key={d.code} className="block">
                          <strong>{d.code}</strong> <span className="text-muted">{d.text}</span>
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {questions.length > 8 && (
          <Button variant="ghost" onClick={() => setShowAllQuestions((v) => !v)} className="self-start">
            {showAllQuestions ? "Mostrar só as 8 mais erradas" : `Ver todas as ${questions.length} questões`}
          </Button>
        )}
      </section>

      <section aria-labelledby="res-descritores" className="glass flex flex-col gap-3 rounded-2xl p-4">
        <div className="flex flex-col gap-1">
          <h2 id="res-descritores" className="section-title">
            Descritores: onde reforçar
          </h2>
          <p className="caption">
            Taxa de acerto da turma em cada descritor, do mais frágil ao mais consolidado. Crítico: abaixo de 50% · Em
            desenvolvimento: 50% a 69% · Consolidado: 70% ou mais.
          </p>
        </div>
        {descriptors.length === 0 ? (
          <p className="caption">Nenhuma questão tem descritor. Ligue os descritores no Gabarito para ver esta análise.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {descriptors.map((d) => {
              const style = LEVEL_STYLE[d.level];
              return (
                <li key={d.descriptor.code} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <strong>{d.descriptor.code}</strong> <span className="text-muted">{d.descriptor.text}</span>
                    </p>
                    <p className="caption">
                      Questões {d.questions.join(", ")} · {d.correct} de {d.attempts} respostas certas
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:w-[24rem]">
                    <Meter value={d.hitRate} className={style.bar} label={`${d.descriptor.code}: ${formatPercent(d.hitRate)} de acerto`} />
                    <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{formatPercent(d.hitRate)}</span>
                    <span
                      className={`w-[8.5rem] shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-center text-2xs font-semibold ${style.badge}`}
                    >
                      <span aria-hidden="true">{style.icon} </span>
                      {LEVEL_LABELS[d.level]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="res-criticos" className="glass flex flex-col gap-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="res-criticos" className="section-title">
              Alunos em situação crítica ({critical.length})
            </h2>
            <p className="caption">Abaixo do limiar de acerto, com os descritores que ainda não consolidaram.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            Limiar
            <select
              value={Math.round(assessment.criticalThreshold * 100)}
              onChange={(e) => onThresholdChange(Number(e.target.value) / 100)}
              className="glass min-h-[40px] rounded-full px-3 text-sm"
            >
              {[30, 40, 50, 60, 70].map((v) => (
                <option key={v} value={v}>
                  {v}%
                </option>
              ))}
              {![30, 40, 50, 60, 70].includes(Math.round(assessment.criticalThreshold * 100)) && (
                <option value={Math.round(assessment.criticalThreshold * 100)}>
                  {Math.round(assessment.criticalThreshold * 100)}%
                </option>
              )}
            </select>
          </label>
        </div>
        {critical.length === 0 ? (
          <p className="text-sm text-prio-low">Nenhum aluno abaixo de {formatPercent(assessment.criticalThreshold)}.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {critical.map((s) => (
              <StudentRow key={s.sheet.id} result={s} onOpen={() => setOpenStudent(s)} />
            ))}
          </ul>
        )}
        <Button variant="ghost" onClick={() => setShowAllStudents((v) => !v)} className="self-start">
          {showAllStudents ? "Esconder a turma toda" : `Ver todos os ${students.length} alunos`}
        </Button>
        {showAllStudents && (
          <ul aria-label="Todos os alunos" className="flex flex-col divide-y divide-line border-t border-line">
            {[...students].reverse().map((s) => (
              <StudentRow key={s.sheet.id} result={s} onOpen={() => setOpenStudent(s)} />
            ))}
          </ul>
        )}
        {summary.missing.length > 0 && (
          <p className="caption">Sem cartão corrigido: {summary.missing.join(", ")}.</p>
        )}
      </section>

      <StudentSheetModal assessment={assessment} result={openStudent} onClose={() => setOpenStudent(null)} />
    </div>
  );
}

function StudentRow({ result, onOpen }: { result: StudentResult; onOpen: () => void }) {
  const { sheet, score, gaps, critical } = result;
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{sheet.studentName}</p>
        <p className="caption">
          {gaps.length === 0
            ? "Todos os descritores avaliados com 50% ou mais."
            : `Não consolidados: ${gaps
                .slice(0, 4)
                .map((g) => g.descriptor.code)
                .join(", ")}${gaps.length > 4 ? ` e mais ${gaps.length - 4}` : ""}`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-bold tabular-nums ${critical ? "text-prio-urgent" : ""}`}>
          {formatPercent(score.percent)}
        </span>
        <span className="text-xs text-muted tabular-nums">
          {score.correct}/{score.scored}
        </span>
        <Button variant="secondary" onClick={onOpen} aria-label={`Ver o cartão de ${sheet.studentName}`}>
          Ver cartão
        </Button>
      </div>
    </li>
  );
}
