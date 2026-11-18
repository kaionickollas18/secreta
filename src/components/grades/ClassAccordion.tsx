import { useId } from "react";
import { classDisplayName, type ClassBlock } from "../../utils/grades";
import { GradeTable } from "./GradeTable";

interface ClassAccordionProps {
  block: ClassBlock;
  open: boolean;
  onToggle: () => void;
}

/** Uma turma: abre e fecha; dentro, uma tabela por disciplina. */
export function ClassAccordion({ block, open, onToggle }: ClassAccordionProps) {
  const panelId = useId();
  const { classroom, subjects } = block;

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
            {subjects.length} {subjects.length === 1 ? "disciplina" : "disciplinas"}
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
          {subjects.map((subject) => (
            <GradeTable key={subject.subject.id} classroom={classroom} block={subject} />
          ))}
        </div>
      )}
    </li>
  );
}
