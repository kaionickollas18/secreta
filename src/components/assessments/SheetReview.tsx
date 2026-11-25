import { useId } from "react";
import type { AnswerSheet, Assessment, MarkFlag } from "../../types/assessment";
import { choicesFor, formatPercent, scoreSheet } from "../../utils/assessments";
import { needsReview, setAnswer, type PendingSheet } from "../../utils/sheetReview";
import { Button } from "../ui/Button";

interface SheetReviewProps {
  assessment: Assessment;
  pending: PendingSheet;
  /** Cartões já salvos (para avisar que salvar substitui o do aluno). */
  saved: readonly AnswerSheet[];
  onChange: (next: PendingSheet) => void;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
  discardLabel?: string;
}

const FLAG_TEXT: Record<MarkFlag, string> = {
  ok: "",
  blank: "em branco",
  multiple: "duas ou mais marcadas",
  uncertain: "marca fraca",
};

/** Conferência de um cartão antes de salvar: imagem com a leitura por cima e as respostas editáveis. */
export function SheetReview({
  assessment,
  pending,
  saved,
  onChange,
  onSave,
  onDiscard,
  saveLabel = "Salvar",
  discardLabel = "Descartar",
}: SheetReviewProps) {
  const id = useId();
  const choices = choicesFor(assessment.alternatives);
  const review = needsReview(pending.flags);
  const student = assessment.roster.find((r) => r.slot === pending.slot);
  const previous = saved.find((s) => s.slot === pending.slot && s.id !== pending.id);
  const score = scoreSheet(assessment, pending);
  const image = pending.image;
  const bubbleRadius = (() => {
    const [a, b] = image?.bubbles ?? [];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) * 0.42 : 8;
  })();

  return (
    <div className="flex flex-col gap-4">
      {image && (
        <figure className="flex flex-col items-center gap-1">
          <div className="relative inline-block max-w-full overflow-hidden rounded-xl border border-line bg-white">
            <img src={image.src} alt={`Foto do cartão: ${pending.label}`} className="block max-h-[52vh] w-auto max-w-full" />
            <svg
              viewBox={`0 0 ${image.width} ${image.height}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              {image.bubbles.map((b) => {
                const flag = pending.flags[b.question];
                const chosen = pending.answers[b.question] === b.choice;
                const doubtful = flag === "multiple" || flag === "uncertain";
                if (!chosen && !doubtful) return null;
                return (
                  <circle
                    key={`${b.question}-${b.choice}`}
                    cx={b.x}
                    cy={b.y}
                    r={bubbleRadius}
                    fill="none"
                    strokeWidth={Math.max(2, bubbleRadius / 4)}
                    stroke={chosen && !doubtful ? "#24a148" : "#f1a10a"}
                  />
                );
              })}
            </svg>
          </div>
          <figcaption className="caption">
            {pending.label} · verde: lido · laranja: conferir
          </figcaption>
        </figure>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium" htmlFor={`${id}-aluno`}>
          Aluno
          <select
            id={`${id}-aluno`}
            value={pending.slot}
            onChange={(e) => onChange({ ...pending, slot: Number(e.target.value) })}
            className={`glass min-h-[44px] rounded-xl px-3 text-sm ${student ? "" : "ring-2 ring-prio-medium"}`}
          >
            <option value={0} disabled>
              Escolher o aluno…
            </option>
            {assessment.roster.map((r) => (
              <option key={r.slot} value={r.slot}>
                {r.slot}. {r.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm sm:pb-3" aria-live="polite">
          <strong className="tabular-nums">
            {score.correct}/{score.scored}
          </strong>{" "}
          acertos ({formatPercent(score.percent)})
        </p>
      </div>
      {previous && (
        <p role="note" className="rounded-xl bg-prio-medium-tint px-3 py-2 text-sm text-prio-medium">
          {previous.studentName} já tem um cartão salvo ({formatPercent(scoreSheet(assessment, previous).percent)}). Salvar
          substitui o anterior.
        </p>
      )}
      {review.length > 0 ? (
        <p role="status" className="rounded-xl bg-prio-medium-tint px-3 py-2 text-sm text-prio-medium">
          Confira {review.length === 1 ? "a questão" : "as questões"} {review.map((i) => i + 1).join(", ")}: escolha a
          resposta certa ou deixe em branco.
        </p>
      ) : (
        !student && (
          <p role="status" className="caption">
            Cartão sem aluno identificado: escolha o aluno para salvar.
          </p>
        )
      )}

      <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {assessment.questions.map((question, index) => {
          const flag = pending.flags[index] ?? "ok";
          const doubtful = flag === "multiple" || flag === "uncertain";
          const answer = pending.answers[index] ?? null;
          return (
            <li
              key={question.number}
              className={`flex items-center gap-2 rounded-xl px-2 py-1 ${doubtful ? "bg-prio-medium-tint" : ""}`}
            >
              <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums">{question.number}</span>
              <div role="radiogroup" aria-label={`Resposta da questão ${question.number}`} className="flex gap-1">
                {choices.map((choice) => {
                  const active = answer === choice;
                  const right = question.key === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onChange(setAnswer(pending, index, choice))}
                      className={`h-9 w-9 rounded-full text-sm font-bold transition-colors ${
                        active
                          ? right
                            ? "bg-prio-low text-white"
                            : question.key === null
                              ? "bg-accent-strong text-white"
                              : "bg-prio-urgent text-white"
                          : "bg-raised/70 text-ink hover:bg-raised"
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="radio"
                  aria-checked={answer === null}
                  aria-label={`Questão ${question.number} em branco`}
                  onClick={() => onChange(setAnswer(pending, index, null))}
                  className={`h-9 w-9 rounded-full text-sm ${answer === null ? "bg-ink/80 text-canvas" : "text-muted hover:bg-raised"}`}
                >
                  –
                </button>
              </div>
              {flag !== "ok" && <span className="truncate text-2xs text-muted">{FLAG_TEXT[flag]}</span>}
            </li>
          );
        })}
      </ol>
      <p className="caption">Verde: acerto · vermelho: erro (o gabarito está na aba Gabarito).</p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onDiscard}>
          {discardLabel}
        </Button>
        <Button variant="primary" onClick={onSave} disabled={!student}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
