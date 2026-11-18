import { useId } from "react";
import { classDisplayName, type ClassItem, type SubjectBlock } from "../../utils/grades";
import { Skeleton } from "../ui/Skeleton";
import { GradeTable } from "./GradeTable";

interface ClassAccordionProps {
  item: ClassItem;
  open: boolean;
  /** Tabelas da turma aberta, ou o andamento da carga das notas dela. */
  content: SubjectBlock[] | "loading" | "error";
  onToggle: () => void;
  onRetry: () => void;
  onOpenStudent: (studentId: string) => void;
}

/** Uma turma: abre e fecha; ao abrir, as notas dela chegam e aparece uma tabela por disciplina. */
export function ClassAccordion({ item, open, content, onToggle, onRetry, onOpenStudent }: ClassAccordionProps) {
  const panelId = useId();
  const { classroom, studentCount, matches } = item;

  return (
    <li className="glass rounded-2xl">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-2 text-left"
        >
          <span className="card-title">{classDisplayName(classroom.name)}</span>
          <span className="flex items-center gap-3 text-sm text-muted">
            {matches > 0 ? `${matches} de ${studentCount} alunos` : `${studentCount} alunos`}
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`h-5 w-5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
      </h3>
      {open && (
        <div id={panelId} className="flex flex-col gap-4 border-t border-line p-3 sm:p-4">
          {content === "loading" ? (
            <>
              <p role="status" className="sr-only">
                Carregando as notas da turma…
              </p>
              <Skeleton className="h-40 rounded-2xl" />
            </>
          ) : content === "error" ? (
            <p role="alert" className="text-sm text-prio-urgent">
              Não foi possível carregar as notas desta turma.{" "}
              <button type="button" className="underline" onClick={onRetry}>
                Tentar de novo
              </button>
            </p>
          ) : content.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma nota desta turma com a disciplina ou o nome escolhidos.</p>
          ) : (
            content.map((block) => (
              <GradeTable key={block.subject.id} classroom={classroom} block={block} onOpenStudent={onOpenStudent} />
            ))
          )}
        </div>
      )}
    </li>
  );
}
