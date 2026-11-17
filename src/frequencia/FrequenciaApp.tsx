import { useEffect, useMemo, useRef, useState } from "react";
import { BarList } from "../components/attendance/BarList";
import { BuscaAtivaDocument } from "../components/attendance/BuscaAtivaDocument";
import { BuscaAtivaMonthsModal } from "../components/attendance/BuscaAtivaMonthsModal";
import { ClassDocument } from "../components/attendance/ClassDocument";
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
import { buscaAtivaImages } from "../constants/buscaAtiva";
import { useAttendanceData } from "../hooks/useAttendanceData";
import { useAuthStore } from "../store/authStore";
import { useHolidayStore } from "../store/holidayStore";
import { useSchoolStore } from "../store/schoolStore";
import { useStudentStore } from "../store/studentStore";
import { useToastStore } from "../store/toastStore";
import type { AttendanceStatus, ClassData } from "../types/attendance";
import { prefersReducedMotion } from "../utils/arrivals";
import { todayISO } from "../utils/date";
import { classReport } from "../utils/classReport";
import { canConfigureDashboard, canSeeStudentRecords, effectiveRole } from "../utils/roles";
import { nextSchoolDay } from "../utils/holidays";
import { hasIdentity } from "../utils/schoolIdentity";
import { buscaAtivaPeriod, findStudent, preloadImages } from "../utils/students";
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
  /** Turma cujo relatório está indo para a impressão (só um documento por vez na folha). */
  const [printingClass, setPrintingClass] = useState<string | null>(null);
  const searchRef = useRef<HTMLElement>(null);
  const allClasses = data?.classes ?? NO_CLASSES;
  const canConfigure = profile ? canConfigureDashboard(effectiveRole(profile)) : false;
  const canBuscaAtiva = profile ? canSeeStudentRecords(profile.role) : false;
  const studentRecords = useStudentStore((s) => s.students);
  const studentStatus = useStudentStore((s) => s.status);
  const loadStudents = useStudentStore((s) => s.load);
  /** Janela de escolha dos meses da busca ativa aberta. */
  const [choosingBuscaMonths, setChoosingBuscaMonths] = useState(false);
  /** Meses escolhidos (YYYY-MM): o documento de busca ativa está indo para a impressão. */
  const [buscaMonths, setBuscaMonths] = useState<string[] | null>(null);
  const printingBusca = buscaMonths !== null;

  /** Feriados e recessos da escola: o comparecimento pedido no termo cai no próximo dia de atendimento. */
  const schoolEvents = useHolidayStore((s) => s.holidays);
  const loadHolidays = useHolidayStore((s) => s.load);

  useEffect(() => {
    if (!schoolId || !canBuscaAtiva) return;
    void loadStudents(schoolId);
    void loadHolidays();
  }, [schoolId, canBuscaAtiva, loadStudents, loadHolidays]);

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

  const studentRecord = useMemo(
    () => (report ? findStudent(studentRecords, report.className, report.name) : null),
    [studentRecords, report],
  );
  /** Faltas dos meses escolhidos para a busca ativa, com o último dia de chamada deles. */
  const buscaPeriod = useMemo(() => {
    if (!report || !buscaMonths) return null;
    const records = allClasses.find((c) => c.name === report.className)?.records ?? [];
    return buscaAtivaPeriod(
      report,
      buscaMonths,
      records.map((record) => record.date),
    );
  }, [allClasses, report, buscaMonths]);

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

  /** Avisa se faltam os dados da escola e abre a impressão; o nome do PDF sugerido é o título da página. */
  function openPrint(fileTitle: string) {
    if (!hasIdentity(identity)) {
      pushToast({
        tone: "info",
        message: canConfigure
          ? "Preencha os “Dados da escola” para o cabeçalho do documento sair completo."
          : "O secretário ainda não preencheu os dados da escola; o cabeçalho sai incompleto.",
      });
    }
    const title = document.title;
    document.title = fileTitle;
    window.addEventListener("afterprint", () => (document.title = title), { once: true });
    window.print();
  }

  // O relatório da turma só entra na página na hora de imprimir; depois sai, para não
  // aparecer junto quando o documento de um aluno for impresso.
  const classToPrint = useMemo(() => {
    const cls = printingClass ? allClasses.find((c) => c.name === printingClass) : undefined;
    return cls ? classReport(cls) : null;
  }, [allClasses, printingClass]);

  useEffect(() => {
    if (!classToPrint) return;
    const done = () => setPrintingClass(null);
    window.addEventListener("afterprint", done, { once: true });
    openPrint(`Frequência da turma - ${classToPrint.name}`);
    return () => window.removeEventListener("afterprint", done);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- imprime uma vez por pedido
  }, [classToPrint]);

  /** Busca ativa: primeiro escolhe os meses que entram no documento. */
  function requestBuscaAtiva() {
    if (studentStatus === "loading") {
      pushToast({ tone: "info", message: "Carregando o cadastro dos alunos. Tente de novo em instantes." });
      return;
    }
    setChoosingBuscaMonths(true);
  }

  /** Meses escolhidos: avisa o que vai faltar no documento e pede a impressão. */
  function confirmBuscaAtiva(months: string[]) {
    setChoosingBuscaMonths(false);
    if (studentStatus === "error") {
      pushToast({
        tone: "error",
        message: "Não foi possível carregar o cadastro dos alunos; o documento sai sem responsável e endereço.",
      });
      if (schoolId) void loadStudents(schoolId);
    } else if (!studentRecord) {
      pushToast({
        tone: "info",
        message: "Aluno não encontrado no cadastro: o documento sai só com nome, turma e faltas.",
      });
    }
    setBuscaMonths(months);
  }

  // Como o relatório da turma: entra na página só para imprimir, depois das imagens de fundo carregarem.
  useEffect(() => {
    if (!printingBusca) return;
    if (!report || !buscaPeriod) return setBuscaMonths(null);
    let cancelled = false;
    const done = () => setBuscaMonths(null);
    void preloadImages(buscaAtivaImages(identity.inep)).then(() => {
      if (cancelled) return;
      window.addEventListener("afterprint", done, { once: true });
      openPrint(`Busca ativa - ${report.name}`);
    });
    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- imprime uma vez por pedido
  }, [printingBusca]);

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
              {className !== "all" && (
                <Button variant="primary" onClick={() => setPrintingClass(className)}>
                  Baixar relatório da turma
                </Button>
              )}
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
                  onPrint={() => openPrint(`Frequência - ${report.name}`)}
                  onBuscaAtiva={canBuscaAtiva ? requestBuscaAtiva : undefined}
                />
                {canBuscaAtiva && (
                  <BuscaAtivaMonthsModal
                    open={choosingBuscaMonths}
                    report={report}
                    onClose={() => setChoosingBuscaMonths(false)}
                    onConfirm={confirmBuscaAtiva}
                  />
                )}
                {buscaPeriod && (
                  <BuscaAtivaDocument
                    report={report}
                    student={studentRecord}
                    identity={identity}
                    issuedOn={todayISO()}
                    attendOn={nextSchoolDay(todayISO(), schoolEvents)}
                    period={buscaPeriod}
                  />
                )}
                {!classToPrint && !printingBusca && (
                <StudentDocument
                  report={report}
                  identity={identity}
                  issuedBy={profile?.fullName ?? ""}
                  issuedOn={todayISO()}
                />
                )}
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
            <ClassesTable classes={view.classSummaries} onPrint={setPrintingClass} />
          </section>
        </>
      )}

      {classToPrint && (
        <ClassDocument
          report={classToPrint}
          identity={identity}
          issuedBy={profile?.fullName ?? ""}
          issuedOn={todayISO()}
        />
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
