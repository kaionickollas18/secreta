import { useEffect, useMemo, useState } from "react";
import { ClassAccordion } from "../components/grades/ClassAccordion";
import { GradeImportModal } from "../components/grades/GradeImportModal";
import { ReportCardModal } from "../components/grades/ReportCardModal";
import { StudentListImportModal } from "../components/grades/StudentListImportModal";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { SearchIcon } from "../components/ui/Icons";
import { Skeleton } from "../components/ui/Skeleton";
import { ToastViewport } from "../components/ui/ToastViewport";
import { useAuthStore } from "../store/authStore";
import { classKey, useGradeStore } from "../store/gradeStore";
import { useSchoolStore } from "../store/schoolStore";
import { useToastStore } from "../store/toastStore";
import type { Segment, Term } from "../types/grade";
import {
  classDisplayName,
  compareClassrooms,
  groupClassGrades,
  isTerm,
  listClasses,
  SEGMENTS,
  sortSubjects,
  TERMS,
  termLabel,
  termSent,
  type SubjectBlock,
} from "../utils/grades";

type Tab = "bimestrais" | "historicos";

const TABS: { key: Tab; label: string; soon?: boolean }[] = [
  { key: "bimestrais", label: "Notas bimestrais" },
  { key: "historicos", label: "Históricos escolares", soon: true },
];

const SELECT = "glass min-h-[44px] w-full rounded-full px-3 text-sm sm:w-auto";
const SEGMENT_BUTTONS: Record<Segment, string> = { ef1: "Enviar notas EF I", ef2: "Enviar notas EF II" };

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** Notas: notas bimestrais por turma e disciplina (e, em breve, os históricos escolares). */
export default function NotasEscolaresApp() {
  const schoolId = useAuthStore((s) => s.profile?.schoolId ?? null);
  const { data, status, classes: classGrades, load, loadClass, students: studentGrades, loadStudent } = useGradeStore();
  const identity = useSchoolStore((s) => s.identity);
  const loadIdentity = useSchoolStore((s) => s.load);
  const pushToast = useToastStore((s) => s.push);
  const schoolYear = new Date().getFullYear();

  const [tab, setTab] = useState<Tab>("bimestrais");
  const [term, setTerm] = useState<Term>(1);
  const [classroomId, setClassroomId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [query, setQuery] = useState("");
  /** Turmas abertas ou fechadas à mão; as demais seguem o padrão (abertas só ao filtrar). */
  const [openClasses, setOpenClasses] = useState<Map<string, boolean>>(new Map());
  const [importingList, setImportingList] = useState(false);
  const [importingSegment, setImportingSegment] = useState<Segment | null>(null);
  /** Aluno com o boletim aberto. */
  const [reportStudentId, setReportStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (schoolId) void load(schoolId, schoolYear);
  }, [schoolId, schoolYear, load]);

  // Nome e logo da escola vão no cabeçalho do boletim.
  useEffect(() => {
    if (schoolId) void loadIdentity(schoolId);
  }, [schoolId, loadIdentity]);

  function openReport(studentId: string) {
    setReportStudentId(studentId);
    if (schoolId) void loadStudent(schoolId, studentId);
  }

  const reportStudent = reportStudentId ? (data.students.find((s) => s.id === reportStudentId) ?? null) : null;
  const reportGrades = reportStudentId ? studentGrades[reportStudentId] : undefined;
  // A turma do boletim é a das notas do aluno (a do cadastro, se ele ainda não tiver nota).
  const reportClassroom = (() => {
    const fromGrades = Array.isArray(reportGrades) ? reportGrades[0]?.classroomId : undefined;
    return (
      data.classrooms.find((c) => c.id === fromGrades) ??
      data.classrooms.find((c) => c.name === reportStudent?.className) ??
      null
    );
  })();

  const classrooms = useMemo(() => [...data.classrooms].sort(compareClassrooms), [data.classrooms]);
  const subjects = useMemo(() => sortSubjects(data.subjects), [data.subjects]);
  // Só a lista de turmas: as notas de cada uma vêm quando ela é aberta.
  const segments = useMemo(() => listClasses(data, { term, classroomId, query }), [data, term, classroomId, query]);
  // Com filtro de turma ou busca por nome, as turmas encontradas já aparecem abertas.
  const filtering = classroomId !== "" || query.trim() !== "";
  const isOpen = (id: string): boolean => openClasses.get(id) ?? filtering;
  const loading = status === "idle" || status === "loading";
  const termAvailable = SEGMENTS.some((segment) => termSent(data, segment, term));
  const openIds = segments.flatMap((segment) => segment.classes.map((item) => item.classroom.id)).filter(isOpen);
  const openKey = openIds.join(",");

  // Baixa as notas das turmas abertas (cada uma uma vez por bimestre).
  useEffect(() => {
    if (!schoolId || status !== "ready") return;
    for (const id of openKey ? openKey.split(",") : []) void loadClass(schoolId, id, term);
  }, [schoolId, status, term, openKey, loadClass]);

  function classContent(classroomId: string): SubjectBlock[] | "loading" | "error" {
    const loaded = classGrades[classKey(classroomId, term)];
    if (loaded === undefined || loaded === "loading") return "loading";
    if (loaded === "error") return "error";
    return groupClassGrades(loaded, data, { subjectId, query });
  }

  function toggle(id: string) {
    setOpenClasses((current) => new Map(current).set(id, !isOpen(id)));
  }

  function saved(message: string) {
    setImportingList(false);
    setImportingSegment(null);
    pushToast({ tone: "success", message });
    if (schoolId) void load(schoolId, schoolYear, true);
  }

  const lastImport = (segment: Segment) => data.imports.find((item) => item.segment === segment) ?? null;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Notas</h1>
          <p className="page-lede">Notas bimestrais de cada turma e disciplina, lidas do boletim escolar da rede.</p>
        </div>
      </header>

      <div role="tablist" aria-label="Seções de notas" className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`tab-${item.key}`}
            aria-selected={tab === item.key}
            aria-controls={`painel-${item.key}`}
            onClick={() => setTab(item.key)}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
              tab === item.key ? "bg-accent-strong text-white" : "bg-raised/80 text-ink hover:bg-raised"
            }`}
          >
            {item.label}
            {item.soon && (
              <span
                className={`rounded-full px-2 text-2xs ${
                  tab === item.key ? "bg-white/20 text-white" : "bg-accent-soft text-accent-light"
                }`}
              >
                Em breve
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "historicos" ? (
        <section role="tabpanel" id="painel-historicos" aria-labelledby="tab-historicos">
          <EmptyState
            title="Históricos escolares: em breve"
            description="Esta seção ainda está sendo preparada. Por enquanto, use as notas bimestrais."
          />
        </section>
      ) : (
        <section role="tabpanel" id="painel-bimestrais" aria-labelledby="tab-bimestrais" className="flex flex-col gap-5">
          {status === "ready" && (
            <section aria-label="Envios" className="glass flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button variant="depth" onClick={() => setImportingList(true)}>
                  Cadastro de alunos
                </Button>
                {SEGMENTS.map((segment) => (
                  <Button key={segment} variant="primary" onClick={() => setImportingSegment(segment)}>
                    {SEGMENT_BUTTONS[segment]}
                  </Button>
                ))}
              </div>
              <ul className="caption space-y-0.5">
                <li>
                  {data.students.length} alunos no cadastro de {schoolYear}
                  {data.students.some((s) => s.registration) ? "" : " (envie a lista de matriculados para ligar os boletins pela matrícula)"}.
                </li>
                {SEGMENTS.map((segment) => {
                  const last = lastImport(segment);
                  return (
                    <li key={segment}>
                      {segment === "ef1" ? "EF I" : "EF II"}:{" "}
                      {last
                        ? `notas até o ${termLabel(last.upToTerm)}, enviadas em ${formatDateTime(last.importedAt)}${
                            last.importedByName ? ` por ${last.importedByName}` : ""
                          }.`
                        : "nenhum boletim enviado ainda."}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div role="search" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              aria-label="Bimestre"
              value={term}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (isTerm(next)) setTerm(next);
              }}
              className={SELECT}
            >
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {termLabel(t)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por turma"
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              className={SELECT}
            >
              <option value="">Todas as turmas</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classDisplayName(classroom.name)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por disciplina"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className={SELECT}
            >
              <option value="">Todas as disciplinas</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <SearchIcon />
              </span>
              <input
                type="search"
                aria-label="Buscar aluno"
                placeholder="Buscar aluno pelo nome"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="glass min-h-[44px] w-full rounded-full py-2 pl-10 pr-3 text-sm placeholder:text-muted"
              />
            </div>
          </div>

          {status === "error" ? (
            <p role="alert" className="text-sm text-prio-urgent">
              Não foi possível carregar as notas.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => schoolId && void load(schoolId, schoolYear, true)}
              >
                Tentar de novo
              </button>
            </p>
          ) : loading ? (
            <div>
              <p role="status" className="sr-only">
                Carregando as notas…
              </p>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-12 rounded-2xl" />
                <Skeleton className="h-12 rounded-2xl" />
                <Skeleton className="h-12 rounded-2xl" />
              </div>
            </div>
          ) : !termAvailable ? (
            <EmptyState
              title={`Nenhuma nota do ${termLabel(term)} ainda`}
              description="As notas aparecem aqui depois que o boletim em PDF de cada segmento for enviado."
            />
          ) : segments.length === 0 ? (
            <EmptyState title="Nada encontrado" description="Nenhuma turma ou aluno bate com o filtro ou o nome buscado." />
          ) : (
            segments.map((segment) => (
              <section key={segment.segment} aria-label={segment.title} className="flex flex-col gap-3">
                <h2 className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold uppercase text-accent-light">
                  {segment.title}
                </h2>
                <ul className="flex flex-col gap-3">
                  {segment.classes.map((item) => {
                    const id = item.classroom.id;
                    const open = isOpen(id);
                    return (
                      <ClassAccordion
                        key={id}
                        item={item}
                        open={open}
                        content={open ? classContent(id) : "loading"}
                        onToggle={() => toggle(id)}
                        onRetry={() => schoolId && void loadClass(schoolId, id, term, true)}
                        onOpenStudent={openReport}
                      />
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </section>
      )}

      {schoolId && (
        <>
          <StudentListImportModal
            open={importingList}
            schoolId={schoolId}
            schoolYear={schoolYear}
            students={data.students}
            onClose={() => setImportingList(false)}
            onSaved={saved}
          />
          <GradeImportModal
            segment={importingSegment}
            schoolId={schoolId}
            schoolYear={schoolYear}
            students={data.students}
            previous={importingSegment ? lastImport(importingSegment) : null}
            onClose={() => setImportingSegment(null)}
            onSaved={saved}
          />
          <ReportCardModal
            student={reportStudent}
            classroom={reportClassroom}
            subjects={data.subjects}
            grades={reportGrades}
            identity={identity}
            schoolYear={schoolYear}
            onClose={() => setReportStudentId(null)}
            onRetry={() => reportStudentId && void loadStudent(schoolId, reportStudentId, true)}
          />
        </>
      )}
      <ToastViewport />
    </div>
  );
}
