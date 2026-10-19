import { useEffect, useMemo, useRef, useState } from "react";
import { BarList } from "../components/attendance/BarList";
import { ClassesTable } from "../components/attendance/ClassesTable";
import { DataSourceModal } from "../components/attendance/DataSourceModal";
import { SchoolIdentityModal } from "../components/attendance/SchoolIdentityModal";
import { StudentDocument } from "../components/attendance/StudentDocument";
import { StudentReportCard } from "../components/attendance/StudentReportCard";
import { StudentSearch } from "../components/attendance/StudentSearch";
import { StudentsTable } from "../components/attendance/StudentsTable";
import { TrendChart } from "../components/attendance/TrendChart";
import { WeekdayChart } from "../components/attendance/WeekdayChart";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ToastViewport } from "../components/ui/ToastViewport";
import { useAttendanceData } from "../hooks/useAttendanceData";
import { useAuthStore } from "../store/authStore";
import { useSchoolStore } from "../store/schoolStore";
import { useToastStore } from "../store/toastStore";
import type { AttendanceStatus, ClassData } from "../types/attendance";
import { prefersReducedMotion } from "../utils/arrivals";
import { todayISO } from "../utils/date";
import { canConfigureDashboard, effectiveRole } from "../utils/roles";
import { hasIdentity } from "../utils/schoolIdentity";
import {
  buildInsights,
  dailySeries,
  formatDay,
  formatNumber,
  selectClasses,
  studentReport,
  summarizeClasses,
  summarizeStudents,
  weekdayStats,
} from "../utils/attendance";
import { normalizeText } from "../utils/tasks";

const CARD = "glass rounded-3xl p-5";

function Kpi({
  label,
  value,
  hint,
  tone = "",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className={`${CARD} !p-4`}>
      <p className="caption">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-1 caption">{hint}</p>}
    </div>
  );
}

/** Texto da linha de situação: de onde vêm os dados e quão recentes são. */
function statusText(status: AttendanceStatus, generatedAt: string | undefined): string {
  const time = generatedAt
    ? new Date(generatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const day = generatedAt ? new Date(generatedAt).toLocaleDateString("pt-BR") : "";
  switch (status) {
    case "loading":
      return "Carregando os dados…";
    case "live":
      return `Ao vivo da planilha · atualizado às ${time}`;
    case "file":
      return `Base offline · enviada em ${day}`;
    case "fallback":
      return `Sem conexão com a planilha. Mostrando a base offline (enviada em ${day}).`;
    case "error":
      return generatedAt
        ? `Não foi possível atualizar. Mostrando os últimos dados carregados (${time}).`
        : "Não foi possível carregar os dados.";
    case "unconfigured":
      return "";
  }
}

const NO_CLASSES: ClassData[] = [];

export default function FrequenciaApp() {
  const { data, status, refreshing, refresh } = useAttendanceData();
  const profile = useAuthStore((s) => s.profile);
  const [className, setClassName] = useState("all");
  const [query, setQuery] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const identity = useSchoolStore((s) => s.identity);
  const loadIdentity = useSchoolStore((s) => s.load);
  const pushToast = useToastStore((s) => s.push);
  const schoolId = profile?.schoolId ?? null;

  useEffect(() => {
    if (schoolId) void loadIdentity(schoolId);
  }, [schoolId, loadIdentity]);
  const [selected, setSelected] = useState<{ className: string; name: string } | null>(null);
  const searchRef = useRef<HTMLElement>(null);
  const allClasses = data?.classes ?? NO_CLASSES;
  const canConfigure = profile ? canConfigureDashboard(effectiveRole(profile)) : false;

  const view = useMemo(() => {
    const classes = selectClasses(allClasses, className);
    const series = dailySeries(classes);
    const students = summarizeStudents(classes);
    const classSummaries = summarizeClasses(classes);
    const totalAbsences = students.reduce((sum, s) => sum + s.absences, 0);
    return {
      series,
      students,
      classSummaries,
      totalAbsences,
      insights: buildInsights(classes),
      weekdays: weekdayStats(series),
      critical: students.filter((s) => s.risk === "critical").length,
    };
  }, [allClasses, className]);

  // A pesquisa olha todas as turmas, mesmo com o filtro de turma ligado.
  const allStudents = useMemo(() => summarizeStudents(allClasses), [allClasses]);
  const report = useMemo(
    () => (selected ? studentReport(allClasses, selected.className, selected.name) : null),
    [allClasses, selected],
  );

  // Ao escolher um aluno (inclusive pela tabela, lá embaixo), leva a tela até o resumo.
  useEffect(() => {
    if (selected) searchRef.current?.scrollIntoView?.({
        block: "start",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
  }, [selected]);

  const needle = normalizeText(query.trim());
  const shownStudents = needle
    ? view.students.filter((s) => normalizeText(s.name).includes(needle))
    : view.students;
  const first = view.series[0]?.date;
  const last = view.series[view.series.length - 1]?.date;
  const avgPerDay =
    view.series.length === 0 ? 0 : view.totalAbsences / view.series.length;
  const byClassBars = [...view.classSummaries]
    .sort((a, b) => b.avgPerDay - a.avgPerDay)
    .map((c) => ({
      label: c.name,
      value: c.avgPerDay,
      display: formatNumber(c.avgPerDay),
      hint: `${c.name}: ${c.absences} faltas em ${c.days} dias`,
    }));

  /** Abre a impressão com o documento do aluno; o nome do PDF sugerido é o título da página. */
  function printStudent(studentName: string) {
    if (!hasIdentity(identity)) {
      pushToast({
        tone: "info",
        message: canConfigure
          ? "Preencha os “Dados da escola” para o cabeçalho do documento sair completo."
          : "O secretário ainda não preencheu os dados da escola; o cabeçalho sai incompleto.",
      });
    }
    const title = document.title;
    document.title = `Frequência - ${studentName}`;
    window.addEventListener("afterprint", () => (document.title = title), { once: true });
    window.print();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">
            Frequência dos alunos
          </h1>
          <p className="page-lede">
            {first && last
              ? `Faltas registradas de ${formatDay(first)} a ${formatDay(last)}`
              : "Sem registros"}
          </p>
          <p className="caption" role="status" aria-live="polite">
            {statusText(status, data?.generatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data && (
            <>
              <select
                aria-label="Filtrar por turma"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="glass min-h-[40px] rounded-full px-3 text-sm"
              >
                <option value="all">Todas as turmas</option>
                {allClasses.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button onClick={() => void refresh()} disabled={refreshing}>
                {refreshing ? "Atualizando…" : "Atualizar agora"}
              </Button>
            </>
          )}
          {canConfigure && (
            <>
              <Button onClick={() => setIdentityOpen(true)}>Dados da escola</Button>
              <Button variant="depth" onClick={() => setSourceOpen(true)}>
                Base de dados
              </Button>
            </>
          )}
        </div>
      </header>

      {!data && status !== "loading" && (
        <EmptyState
          title={
            status === "unconfigured"
              ? "Base de dados não configurada"
              : "Não foi possível carregar os dados"
          }
          description={
            status === "unconfigured"
              ? canConfigure
                ? "Informe o link da planilha ou envie os arquivos da frequência."
                : "O secretário ainda não informou de onde vêm os dados."
              : "Verifique a conexão ou a configuração da base de dados."
          }
          action={
            canConfigure ? (
              <Button variant="primary" onClick={() => setSourceOpen(true)}>
                Configurar base de dados
              </Button>
            ) : status === "error" ? (
              <Button onClick={() => void refresh()}>Tentar de novo</Button>
            ) : undefined
          }
        />
      )}

      {data && (
        <>
          <section
            aria-label="Indicadores"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <Kpi
              label="Faltas no período"
              value={String(view.totalAbsences)}
              hint={`em ${view.series.length} dias de chamada`}
            />
            <Kpi
              label="Média de faltas por dia"
              value={formatNumber(avgPerDay)}
              hint="somando as turmas selecionadas"
            />
            <Kpi label="Alunos com alguma falta" value={String(view.students.length)} />
            <Kpi
              label="Alunos acima de 25% de faltas"
              value={String(view.critical)}
              hint="risco de reprovação por frequência"
              tone={view.critical > 0 ? "text-prio-urgent" : ""}
            />
          </section>

          <section ref={searchRef} className={`${CARD} scroll-mt-4`} aria-labelledby="h-search">
            <h2 id="h-search" className="mb-3 section-title">
              Pesquisar aluno
            </h2>
            <StudentSearch students={allStudents} onSelect={setSelected} />
            {report && (
              <div className="mt-4">
                <StudentReportCard
                  key={`${report.className}-${report.name}`}
                  report={report}
                  onClose={() => setSelected(null)}
                  onPrint={() => printStudent(report.name)}
                />
                <StudentDocument
                  report={report}
                  identity={identity}
                  issuedBy={profile?.fullName ?? ""}
                  issuedOn={todayISO()}
                />
              </div>
            )}
            {selected && !report && (
              <p role="status" className="mt-4 text-sm text-muted">
                {selected.name} não tem mais faltas registradas nos dados atuais.
              </p>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-3">
            <section className={`${CARD} lg:col-span-2`} aria-labelledby="h-trend">
              <h2 id="h-trend" className="mb-3 section-title">
                Faltas por dia
              </h2>
              <TrendChart points={view.series} />
            </section>

            <section className={CARD} aria-labelledby="h-insights">
              <h2 id="h-insights" className="mb-3 section-title">
                Destaques
              </h2>
              {view.insights.length === 0 ? (
                <p className="text-sm text-muted">
                  Sem dados suficientes para gerar destaques.
                </p>
              ) : (
                <ul className="space-y-3">
                  {view.insights.map((text) => (
                    <li key={text} className="flex gap-2 text-sm leading-snug">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-magenta"
                      />
                      {text}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={CARD} aria-labelledby="h-classes">
              <h2 id="h-classes" className="mb-1 section-title">
                Média de faltas por dia, por turma
              </h2>
              <p className="mb-4 caption">
                Comparar pela média evita distorção entre turmas com mais ou menos dias de
                chamada.
              </p>
              <BarList
                items={byClassBars}
                label="Média de faltas por dia em cada turma"
              />
            </section>

            <section className={CARD} aria-labelledby="h-weekday">
              <h2 id="h-weekday" className="mb-1 section-title">
                Faltas por dia da semana
              </h2>
              <p className="mb-4 caption">
                Média de faltas por dia de chamada. O dia mais crítico está em destaque.
              </p>
              <WeekdayChart stats={view.weekdays} />
            </section>
          </div>

          <section className={CARD} aria-labelledby="h-students">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="h-students" className="section-title">
                  Alunos que mais faltam
                </h2>
                <p className="caption">
                  Crítico: mais de 25% dos dias · Atenção: de 15% a 25% · Seguidas: faltas
                  consecutivas até o último dia. Clique em um nome para ver o resumo.
                </p>
              </div>
              <input
                type="search"
                aria-label="Filtrar a lista de alunos"
                placeholder="Filtrar a lista"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="glass min-h-[40px] w-full rounded-full px-4 text-sm placeholder:text-muted sm:w-64"
              />
            </div>
            <StudentsTable
              key={`${className}-${query}`}
              students={shownStudents}
              showClass={className === "all"}
              onSelect={setSelected}
            />
          </section>

          <section className={CARD} aria-labelledby="h-summary">
            <h2 id="h-summary" className="mb-3 section-title">
              Resumo por turma
            </h2>
            <ClassesTable classes={view.classSummaries} />
          </section>
        </>
      )}

      {profile?.schoolId && canConfigure && (
        <SchoolIdentityModal
          open={identityOpen}
          schoolId={profile.schoolId}
          onClose={() => setIdentityOpen(false)}
        />
      )}
      {profile?.schoolId && canConfigure && (
        <DataSourceModal
          open={sourceOpen}
          schoolId={profile.schoolId}
          onClose={() => setSourceOpen(false)}
        />
      )}
      <ToastViewport />
    </div>
  );
}
