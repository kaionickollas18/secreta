import { useCallback, useEffect, useMemo, useState } from "react";
import { AnswerCardSheets } from "../components/assessments/AnswerCardSheets";
import { AssessmentForm, type ClassOption } from "../components/assessments/AssessmentForm";
import { CorrectionPanel } from "../components/assessments/CorrectionPanel";
import { PedagogicalReportView } from "../components/assessments/PedagogicalReportView";
import { ResultsDashboard } from "../components/assessments/ResultsDashboard";
import { Button, DELETE_BUTTON } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ChevronLeftIcon, PlusIcon, TrashIcon } from "../components/ui/Icons";
import { Skeleton } from "../components/ui/Skeleton";
import { ToastViewport } from "../components/ui/ToastViewport";
import { MATRIX_LABELS, SUBJECT_LABELS } from "../constants/descriptors";
import { sheetsOf, useAssessmentStore } from "../store/assessmentStore";
import { useAuthStore } from "../store/authStore";
import { useGradeStore } from "../store/gradeStore";
import { useSchoolStore } from "../store/schoolStore";
import { useToastStore } from "../store/toastStore";
import type { Assessment, AssessmentSubject } from "../types/assessment";
import { classSummary } from "../utils/assessmentAnalytics";
import { assessmentProblems, formatPercent, newAssessment } from "../utils/assessments";
import { compareClassrooms } from "../utils/grades";
import { canDeleteAssessments, effectiveRole } from "../utils/roles";
import { createId } from "../utils/id";

type Tab = "gabarito" | "cartoes" | "correcao" | "resultados" | "devolutiva";

const TABS: { key: Tab; label: string }[] = [
  { key: "gabarito", label: "Gabarito" },
  { key: "cartoes", label: "Cartões" },
  { key: "correcao", label: "Correção" },
  { key: "resultados", label: "Resultados" },
  { key: "devolutiva", label: "Devolutiva" },
];

const isTab = (value: string): value is Tab => TABS.some((t) => t.key === value);

/** "#<id>/<aba>" no endereço: voltar e recarregar a página mantêm a avaliação aberta. */
function readHash(): { id: string | null; tab: Tab } {
  const [id, tab] = window.location.hash.replace(/^#/, "").split("/");
  return { id: id || null, tab: tab && isTab(tab) ? tab : "gabarito" };
}

/** Texto da confirmação de exclusão, no singular ou no plural. */
function deleteMessage(title: string, sheetCount: number): string {
  const name = `"${title || "Sem título"}"`;
  if (sheetCount === 0) return `${name} será apagada. Não dá para desfazer.`;
  const sheets = sheetCount === 1 ? "o cartão corrigido dela" : `os ${sheetCount} cartões corrigidos dela`;
  return `${name} e ${sheets} serão apagados. Não dá para desfazer.`;
}

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

/** Avaliações de Língua Portuguesa e Matemática: gabarito, cartões, correção e resultados. */
export default function AvaliacoesApp() {
  const schoolId = useAuthStore((s) => s.profile?.schoolId ?? null);
  const { status, assessments, sheets, load, save, saveDraft, flushDraft, remove, draftStatus, draftError } =
    useAssessmentStore();
  const profile = useAuthStore((s) => s.profile);
  const gradeData = useGradeStore((s) => s.data);
  const loadGrades = useGradeStore((s) => s.load);
  const identity = useSchoolStore((s) => s.identity);
  const loadIdentity = useSchoolStore((s) => s.load);
  const pushToast = useToastStore((s) => s.push);

  const [route, setRoute] = useState(readHash);
  const [subjectFilter, setSubjectFilter] = useState<AssessmentSubject | "">("");
  const [deleting, setDeleting] = useState<Assessment | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    void load(schoolId);
    // Turmas e alunos vêm do cadastro das Notas.
    void loadGrades(schoolId, new Date().getFullYear());
    void loadIdentity(schoolId);
  }, [schoolId, load, loadGrades, loadIdentity]);

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Edição do gabarito ainda esperando: vai para o banco antes de a página sumir.
  useEffect(() => {
    const flush = () => void flushDraft();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushDraft]);

  useEffect(() => {
    if (draftStatus === "error" && draftError) pushToast({ tone: "error", message: draftError });
  }, [draftStatus, draftError, pushToast]);

  const go = (id: string | null, tab: Tab = "gabarito") => {
    void flushDraft();
    window.location.hash = id ? `${id}/${tab}` : "";
    setRoute({ id, tab });
  };

  const classes: ClassOption[] = useMemo(
    () =>
      [...gradeData.classrooms].sort(compareClassrooms).map((c) => ({
        id: c.id,
        name: c.name,
        students: gradeData.students
          .filter((s) => s.className === c.name && !s.transferred)
          .map((s) => ({ id: s.id, name: s.name, rollNumber: s.rollNumber })),
      })),
    [gradeData],
  );

  const current = assessments.find((a) => a.id === route.id) ?? null;
  const currentSheets = current ? sheetsOf(sheets, current.id) : [];
  const sheetsFor = useCallback((assessmentId: string) => sheetsOf(sheets, assessmentId), [sheets]);

  /** Mudança de uma vez (ex.: limiar nos resultados): grava já. */
  async function update(next: Assessment) {
    const error = await save({ ...next, updatedAt: new Date().toISOString() });
    if (error) pushToast({ tone: "error", message: error });
  }

  const DRAFT_LABELS: Record<typeof draftStatus, string> = {
    idle: "",
    pending: "Salvando…",
    saving: "Salvando…",
    saved: "Salvo",
    error: "Não salvo",
  };

  async function create() {
    const now = new Date().toISOString();
    let assessment: Assessment;
    try {
      assessment = newAssessment({ id: createId(), now, existing: assessments });
    } catch (error) {
      pushToast({ tone: "error", message: error instanceof Error ? error.message : "Não foi possível criar." });
      return;
    }
    const error = await save(assessment);
    if (error) {
      pushToast({ tone: "error", message: error });
      return;
    }
    go(assessment.id, "gabarito");
  }

  const loading = status === "idle" || status === "loading";
  const list = [...assessments]
    .filter((a) => !subjectFilter || a.subject === subjectFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6">
      {current ? (
        <>
          <header className="flex flex-col gap-3">
            <Button variant="ghost" onClick={() => go(null)} className="-ml-3 self-start">
              <ChevronLeftIcon /> Avaliações
            </Button>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="page-title truncate">{current.title || "Nova avaliação"}</h1>
                <p className="page-lede">
                  {SUBJECT_LABELS[current.subject]} · {current.className || "sem turma"} · {shortDate(current.date)} ·{" "}
                  {current.questions.length} questões · cartão nº {current.code}
                  {route.tab === "gabarito" && DRAFT_LABELS[draftStatus] && (
                    <span role="status" className={draftStatus === "error" ? "text-prio-urgent" : ""}>
                      {" "}
                      · {DRAFT_LABELS[draftStatus]}
                    </span>
                  )}
                </p>
              </div>
              {/* Excluir avaliação é só do secretário (regra também no banco). */}
              {profile && canDeleteAssessments(effectiveRole(profile)) && (
                <Button variant="ghost" className={DELETE_BUTTON} onClick={() => setDeleting(current)}>
                  <TrashIcon /> Excluir
                </Button>
              )}
            </div>
            <nav aria-label="Etapas da avaliação">
              <ul className="grid grid-cols-5 gap-0.5 rounded-full bg-raised/70 p-1 sm:flex sm:w-max sm:gap-1">
                {TABS.map((tab, i) => {
                  const active = route.tab === tab.key;
                  return (
                    <li key={tab.key}>
                      <a
                        href={`#${current.id}/${tab.key}`}
                        aria-current={active ? "page" : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          go(current.id, tab.key);
                        }}
                        className={`flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full px-1 text-2xs sm:px-4 sm:text-sm font-semibold transition-colors ${
                          active ? "bg-accent-strong text-white" : "text-muted hover:text-ink"
                        }`}
                      >
                        <span className={`hidden text-xs tabular-nums sm:inline ${active ? "text-white/80" : "text-muted"}`}>{i + 1}</span>
                        {tab.label}
                        {tab.key === "correcao" && currentSheets.length > 0 && (
                          <span className={`hidden text-xs tabular-nums sm:inline ${active ? "text-white/80" : "text-muted"}`}>({currentSheets.length})</span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </header>

          <main>
            {route.tab === "gabarito" && (
              <AssessmentForm
                assessment={current}
                classes={classes}
                correctedCount={currentSheets.length}
                onChange={(next) => saveDraft({ ...next, updatedAt: new Date().toISOString() })}
              />
            )}
            {route.tab === "cartoes" && <AnswerCardSheets assessment={current} schoolName={identity.officialName} />}
            {route.tab === "correcao" && <CorrectionPanel assessment={current} />}
            {route.tab === "resultados" && (
              <ResultsDashboard
                assessment={current}
                sheets={currentSheets}
                assessments={assessments}
                sheetsOf={sheetsFor}
                onThresholdChange={(criticalThreshold) => void update({ ...current, criticalThreshold })}
              />
            )}
            {route.tab === "devolutiva" && (
              <PedagogicalReportView
                assessment={current}
                sheets={currentSheets}
                assessments={assessments}
                sheetsOf={sheetsFor}
                schoolName={identity.officialName}
              />
            )}
          </main>
        </>
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="page-title">Avaliações</h1>
              <p className="page-lede">
                Provas de Língua Portuguesa e Matemática com cartão-resposta: correção pela câmera ou por PDF e análise
                da turma por descritores (Saeb 9º ano, CNCA 1º ano ou da escola).
              </p>
            </div>
            <Button variant="primary" onClick={() => void create()} disabled={loading}>
              <PlusIcon /> Nova avaliação
            </Button>
          </header>

          <div role="group" aria-label="Filtrar por disciplina" className="flex gap-1 self-start rounded-full bg-raised/70 p-1">
            {[
              { value: "" as const, label: "Todas" },
              { value: "lp" as const, label: SUBJECT_LABELS.lp },
              { value: "mt" as const, label: SUBJECT_LABELS.mt },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={subjectFilter === option.value}
                onClick={() => setSubjectFilter(option.value)}
                className={`min-h-[40px] rounded-full px-4 text-sm font-semibold ${
                  subjectFilter === option.value ? "bg-accent-strong text-white" : "text-muted hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))}
            </div>
          ) : status === "error" ? (
            <EmptyState title="Não foi possível carregar as avaliações" />
          ) : list.length === 0 ? (
            <EmptyState
              title={assessments.length ? "Nenhuma avaliação nesta disciplina" : "Nenhuma avaliação ainda"}
              description="Crie a avaliação, defina o gabarito com os descritores, imprima os cartões e corrija pela câmera ou por PDF."
              action={
                <Button variant="primary" onClick={() => void create()}>
                  <PlusIcon /> Nova avaliação
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((a) => {
                const own = sheetsOf(sheets, a.id);
                const summary = classSummary(a, own);
                const pendingSetup = assessmentProblems(a).length > 0;
                return (
                  <li key={a.id}>
                    <a
                      href={`#${a.id}/${own.length ? "resultados" : "gabarito"}`}
                      onClick={(e) => {
                        e.preventDefault();
                        go(a.id, own.length ? "resultados" : pendingSetup ? "gabarito" : "correcao");
                      }}
                      className="glass flex h-full flex-col gap-3 rounded-2xl p-4 transition-shadow hover:shadow-glow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="card-title truncate">{a.title || "Sem título"}</p>
                          <p className="caption truncate">
                            {a.className || "sem turma"} · {shortDate(a.date)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-semibold text-accent-light">
                          {a.subject === "lp" ? "LP" : "MT"}
                        </span>
                      </div>
                      <p className="caption">
                        {a.questions.length} questões · {MATRIX_LABELS[a.matrix]}
                      </p>
                      <div className="mt-auto flex items-end justify-between gap-2">
                        <p className="text-sm text-muted">
                          {pendingSetup ? "Gabarito incompleto" : `${own.length}/${a.roster.length || "?"} corrigidos`}
                        </p>
                        {own.length > 0 && (
                          <p className="text-right">
                            <span className="block text-2xl font-bold leading-none tabular-nums">{formatPercent(summary.mean)}</span>
                            <span className="text-2xs text-muted">média · {summary.belowThreshold} em situação crítica</span>
                          </p>
                        )}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir avaliação?"
        message={
          deleting
            ? deleteMessage(deleting.title, sheetsOf(sheets, deleting.id).length)
            : ""
        }
        confirmLabel="Excluir"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (!target) return;
          void remove(target.id).then((error) => {
            if (error) pushToast({ tone: "error", message: error });
            else go(null);
          });
        }}
      />
      <ToastViewport />
    </div>
  );
}
