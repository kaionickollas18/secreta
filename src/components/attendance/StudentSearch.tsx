import { useState } from "react";
import type { StudentSummary } from "../../types/attendance";
import { searchStudents } from "../../utils/attendance";
import { SearchIcon } from "../ui/Icons";

interface StudentSearchProps {
  /** Todos os alunos com falta registrada, de todas as turmas. */
  students: StudentSummary[];
  onSelect: (student: StudentSummary) => void;
}

/** Campo de pesquisa por nome; os resultados aparecem como botões logo abaixo. */
export function StudentSearch({ students, onSelect }: StudentSearchProps) {
  const [query, setQuery] = useState("");
  const results = searchStudents(students, query);
  const searching = query.trim() !== "";

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          <SearchIcon />
        </span>
        <input
          type="search"
          aria-label="Pesquisar aluno pelo nome"
          aria-describedby="student-search-hint"
          placeholder="Digite o nome do aluno"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="glass min-h-[48px] w-full rounded-full py-2 pl-12 pr-4 text-base placeholder:text-muted"
        />
      </div>
      <p id="student-search-hint" className="mt-1 px-1 text-xs text-muted">
        Aparecem os alunos com pelo menos uma falta registrada (a planilha guarda só os ausentes).
      </p>

      <div role="status" aria-live="polite">
        {searching && results.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            Nenhum aluno com falta registrada corresponde a “{query.trim()}”.
          </p>
        )}
      </div>
      {results.length > 0 && (
        <ul aria-label="Alunos encontrados" className="mt-3 grid gap-2 sm:grid-cols-2">
          {results.map((student) => (
            <li key={`${student.className}-${student.name}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(student);
                  setQuery("");
                }}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3 py-2 text-left text-sm transition-colors hover:bg-raised"
              >
                <span className="min-w-0 break-words font-medium">{student.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {student.className} · {student.absences} {student.absences === 1 ? "falta" : "faltas"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
