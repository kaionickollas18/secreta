import { useState } from "react";
import { createPortal } from "react-dom";
import type { Assessment, RosterEntry } from "../../types/assessment";
import { assessmentProblems } from "../../utils/assessments";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { AnswerCard } from "./AnswerCard";

interface AnswerCardSheetsProps {
  assessment: Assessment;
  schoolName: string;
}

const INPUT = "glass min-h-[44px] w-24 rounded-xl px-3 text-sm";

/** Cartões-resposta para imprimir: um por aluno (com nome e código) e/ou em branco. */
export function AnswerCardSheets({ assessment, schoolName }: AnswerCardSheetsProps) {
  const [named, setNamed] = useState(true);
  const [blankCount, setBlankCount] = useState(assessment.roster.length === 0 ? 2 : 0);
  const problems = assessmentProblems(assessment);

  const cards: (RosterEntry | null)[] = [
    ...(named ? assessment.roster : []),
    ...Array.from({ length: blankCount }, () => null),
  ];
  // Dois cartões por folha A4.
  const pages = Array.from({ length: Math.ceil(cards.length / 2) }, (_, i) => cards.slice(i * 2, i * 2 + 2));

  if (problems.length > 0) {
    return (
      <EmptyState
        title="Complete o gabarito antes de imprimir"
        description={problems.join(" ")}
      />
    );
  }

  return (
    <section aria-labelledby="cartoes-titulo" className="flex flex-col gap-4">
      <div className="glass flex flex-col gap-3 rounded-2xl p-4">
        <h2 id="cartoes-titulo" className="section-title">
          Cartões-resposta
        </h2>
        <p className="caption">
          Folha A4 em pé, dois cartões por folha. Imprima em tamanho real (100%, sem "ajustar à página" se puder) e
          não corte os quadrados pretos dos cantos: eles orientam a leitura. O cartão nominal já traz o aluno no código;
          o cartão em branco pede para escolher o aluno na correção.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex min-h-[44px] items-center gap-2 text-sm">
            <input type="checkbox" checked={named} onChange={(e) => setNamed(e.target.checked)} className="h-5 w-5" />
            Um cartão para cada aluno ({assessment.roster.length})
          </label>
          <label className="flex items-center gap-2 text-sm">
            Cartões em branco
            <input
              type="number"
              min={0}
              max={60}
              value={blankCount}
              onChange={(e) => setBlankCount(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
              className={INPUT}
            />
          </label>
          <Button variant="primary" disabled={cards.length === 0} onClick={() => window.print()} className="sm:ml-auto">
            Imprimir {cards.length} {cards.length === 1 ? "cartão" : "cartões"}
          </Button>
        </div>
        {named && assessment.roster.length === 0 && (
          <p className="caption">A lista de alunos está vazia: adicione os alunos no Gabarito ou use cartões em branco.</p>
        )}
      </div>

      {cards.length === 0 ? (
        <EmptyState title="Nenhum cartão escolhido" />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="caption">Prévia dos primeiros cartões:</p>
          {cards.slice(0, 2).map((student, i) => (
            <div key={student?.slot ?? `branco-${i}`} className="overflow-hidden rounded-xl border border-line bg-white p-1 shadow-card">
              <AnswerCard assessment={assessment} student={student} schoolName={schoolName} />
            </div>
          ))}
        </div>
      )}

      {cards.length > 0 &&
        createPortal(
          <div className="print-document cartoes-print" aria-hidden="true">
            {pages.map((page, p) => (
              <div key={p} className="cartoes-page">
                {page.map((student, i) => (
                  <div key={i} className="cartoes-slot">
                    <AnswerCard assessment={assessment} student={student} schoolName={schoolName} />
                  </div>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </section>
  );
}
