import { useId, useState } from "react";
import { MATRIX_LABELS, SUBJECT_LABELS, defaultMatrix } from "../../constants/descriptors";
import type { Assessment, AssessmentSubject, Choice, Descriptor, DescriptorMatrix } from "../../types/assessment";
import {
  blankQuestions,
  choicesFor,
  descriptorsFor,
  gradeFromClassName,
  isChoice,
  isMatrix,
  MAX_QUESTIONS,
  mergeRoster,
  parseNameList,
  questionsWithoutDescriptor,
} from "../../utils/assessments";
import { Button, DELETE_BUTTON, IconButton } from "../ui/Button";
import { TrashIcon } from "../ui/Icons";
import { DescriptorPicker } from "./DescriptorPicker";

/** Turma do cadastro (Notas), com os alunos ativos dela. */
export interface ClassOption {
  id: string;
  name: string;
  students: { id: string; name: string; rollNumber: number | null }[];
}

interface AssessmentFormProps {
  assessment: Assessment;
  classes: readonly ClassOption[];
  /** Cartões já corrigidos: mudar o gabarito recalcula tudo, então avisamos. */
  correctedCount: number;
  onChange: (next: Assessment) => void;
}

const FIELD = "glass min-h-[44px] w-full rounded-xl px-3 text-sm";
const LABEL = "flex flex-col gap-1 text-sm font-medium";
const OTHER = "__outra__";

interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (value: number) => void;
}

/**
 * Campo numérico que deixa apagar e digitar à vontade: só aplica números inteiros dentro do
 * limite; ao sair do campo, volta a mostrar o valor em vigor.
 */
function NumberField({ value, min, max, step, onCommit }: NumberFieldProps) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      value={text ?? String(value)}
      onFocus={() => setText(String(value))}
      onBlur={() => setText(null)}
      onChange={(e) => {
        setText(e.target.value);
        const next = Number(e.target.value);
        if (e.target.value !== "" && Number.isInteger(next) && next >= min && next <= max) onCommit(next);
      }}
      className={FIELD}
    />
  );
}

export function AssessmentForm({ assessment, classes, correctedCount, onChange }: AssessmentFormProps) {
  const id = useId();
  const [pastedKey, setPastedKey] = useState("");
  const [pastedNames, setPastedNames] = useState("");
  const [custom, setCustom] = useState({ code: "", topic: "", text: "" });
  const [typingClass, setTypingClass] = useState(
    assessment.className !== "" && !classes.some((c) => c.name === assessment.className),
  );

  const update = (patch: Partial<Assessment>) => onChange({ ...assessment, ...patch });
  const choices = choicesFor(assessment.alternatives);
  const options = descriptorsFor(assessment);
  const missing = questionsWithoutDescriptor(assessment);
  const classroom = classes.find((c) => c.id === assessment.classroomId) ?? classes.find((c) => c.name === assessment.className);
  const newFromClass = classroom ? mergeRoster(assessment.roster, classroom.students).length - assessment.roster.length : 0;

  function chooseClass(value: string) {
    if (value === OTHER) {
      setTypingClass(true);
      update({ classroomId: null });
      return;
    }
    const option = classes.find((c) => c.id === value);
    if (!option) return;
    setTypingClass(false);
    const grade = gradeFromClassName(option.name) ?? assessment.grade;
    update({
      classroomId: option.id,
      className: option.name,
      grade,
      matrix: defaultMatrix(grade),
      // Lista vazia: já entra com os alunos da turma.
      roster: assessment.roster.length === 0 ? mergeRoster([], option.students) : assessment.roster,
    });
  }

  function setKey(index: number, key: Choice | null) {
    update({ questions: assessment.questions.map((q, i) => (i === index ? { ...q, key } : q)) });
  }

  function applyPastedKey() {
    const letters = pastedKey.toUpperCase().replace(/[^A-E*-]/g, "").split("");
    if (letters.length === 0) return;
    const count = Math.min(MAX_QUESTIONS, Math.max(assessment.questions.length, letters.length));
    const questions = blankQuestions(count, assessment.questions).map((q, i) => {
      const letter = letters[i];
      if (letter === undefined) return q;
      // "*" ou "-" anula a questão.
      return { ...q, key: isChoice(letter) && choices.includes(letter) ? letter : null };
    });
    update({ questions });
    setPastedKey("");
  }

  function addCustomDescriptor() {
    const code = custom.code.trim().toUpperCase();
    const text = custom.text.trim();
    if (!code || !text) return;
    const descriptor: Descriptor = { code, text, topic: custom.topic.trim(), matrix: "custom", subject: assessment.subject };
    update({
      customDescriptors: [
        ...assessment.customDescriptors.filter((d) => !(d.code === code && d.subject === assessment.subject)),
        descriptor,
      ],
    });
    setCustom({ code: "", topic: "", text: "" });
  }

  return (
    <div className="flex flex-col gap-5">
      {correctedCount > 0 && (
        <p role="note" className="rounded-xl bg-prio-medium-tint px-4 py-3 text-sm text-prio-medium">
          {correctedCount} {correctedCount === 1 ? "cartão já foi corrigido" : "cartões já foram corrigidos"}. Mudanças
          no gabarito recalculam os resultados; mudar a quantidade de questões exige imprimir os cartões de novo.
        </p>
      )}

      <section aria-labelledby={`${id}-dados`} className="glass flex flex-col gap-4 rounded-2xl p-4">
        <h2 id={`${id}-dados`} className="section-title">
          Dados da avaliação
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={`${LABEL} sm:col-span-2`}>
            Título
            <input
              value={assessment.title}
              onChange={(e) => update({ title: e.target.value.slice(0, 120) })}
              placeholder="Ex.: Simulado Saeb 1"
              className={FIELD}
              data-autofocus
            />
          </label>
          <label className={LABEL}>
            Turma
            <select
              value={typingClass ? OTHER : (classroom?.id ?? "")}
              onChange={(e) => chooseClass(e.target.value)}
              className={FIELD}
            >
              <option value="" disabled>
                Escolher…
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={OTHER}>Outra (digitar)</option>
            </select>
          </label>
          {typingClass && (
            <label className={LABEL}>
              Nome da turma
              <input
                value={assessment.className}
                onChange={(e) => {
                  const className = e.target.value.slice(0, 60);
                  const grade = gradeFromClassName(className);
                  update({ className, ...(grade ? { grade, matrix: defaultMatrix(grade) } : {}) });
                }}
                placeholder="Ex.: 9 ano A"
                className={FIELD}
              />
            </label>
          )}
          <label className={LABEL}>
            Ano
            <select
              value={assessment.grade}
              onChange={(e) => {
                const grade = Number(e.target.value);
                update({ grade, matrix: defaultMatrix(grade) });
              }}
              className={FIELD}
            >
              {Array.from({ length: 9 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  {g}º ano
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 sm:col-span-2">
            <legend className="mb-1 text-sm font-medium">Disciplina</legend>
            <div className="flex gap-2">
              {(Object.keys(SUBJECT_LABELS) as AssessmentSubject[]).map((subject) => (
                <label
                  key={subject}
                  className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                    assessment.subject === subject ? "border-accent bg-accent-soft text-accent-light" : "border-line text-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-disciplina`}
                    value={subject}
                    checked={assessment.subject === subject}
                    onChange={() => update({ subject })}
                    className="sr-only"
                  />
                  {SUBJECT_LABELS[subject]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className={LABEL}>
            Matriz de descritores
            <select
              value={assessment.matrix}
              onChange={(e) => {
                const matrix: unknown = e.target.value;
                if (isMatrix(matrix)) update({ matrix: matrix as DescriptorMatrix });
              }}
              className={FIELD}
            >
              {(Object.keys(MATRIX_LABELS) as DescriptorMatrix[]).map((m) => (
                <option key={m} value={m}>
                  {MATRIX_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Data
            <input
              type="date"
              value={assessment.date}
              // Data apagada no campo não é gravada (a avaliação sempre tem data).
              onChange={(e) => {
                if (e.target.value) update({ date: e.target.value });
              }}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Questões
            <NumberField
              min={1}
              max={MAX_QUESTIONS}
              value={assessment.questions.length}
              onCommit={(count) => update({ questions: blankQuestions(count, assessment.questions) })}
            />
          </label>
          <label className={LABEL}>
            Alternativas
            <select
              value={assessment.alternatives}
              onChange={(e) => {
                const alternatives = e.target.value === "5" ? 5 : 4;
                update({
                  alternatives,
                  // Com 4 alternativas, um gabarito "E" deixa de existir.
                  questions: assessment.questions.map((q) => (alternatives === 4 && q.key === "E" ? { ...q, key: null } : q)),
                });
              }}
              className={FIELD}
            >
              <option value={4}>A a D</option>
              <option value={5}>A a E</option>
            </select>
          </label>
          <label className={LABEL}>
            Situação crítica abaixo de
            <span className="flex items-center gap-2">
              <NumberField
                min={10}
                max={90}
                step={5}
                value={Math.round(assessment.criticalThreshold * 100)}
                onCommit={(percent) => update({ criticalThreshold: percent / 100 })}
              />
              <span className="text-muted">%</span>
            </span>
          </label>
        </div>
      </section>

      <section aria-labelledby={`${id}-gabarito`} className="glass flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-gabarito`} className="section-title">
            Gabarito e descritores
          </h2>
          <p className="caption">
            Marque a alternativa correta e ligue cada questão a um ou mais descritores ({MATRIX_LABELS[assessment.matrix]},{" "}
            {SUBJECT_LABELS[assessment.subject]}). "Anular" tira a questão da nota e das análises.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`${id}-colar`}>
            Colar gabarito
          </label>
          <input
            id={`${id}-colar`}
            value={pastedKey}
            onChange={(e) => setPastedKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyPastedKey();
            }}
            placeholder="Colar gabarito de uma vez (ex.: BDACB…; * anula)"
            className={`${FIELD} sm:max-w-md`}
          />
          <Button variant="depth" onClick={applyPastedKey} disabled={!pastedKey.trim()}>
            Preencher
          </Button>
        </div>

        <ol className="flex flex-col divide-y divide-line">
          {assessment.questions.map((question, index) => (
            <li key={question.number} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:gap-4">
              <div className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums">{question.number}</span>
                <div role="radiogroup" aria-label={`Gabarito da questão ${question.number}`} className="flex gap-1">
                  {choices.map((choice) => {
                    const active = question.key === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setKey(index, choice)}
                        className={`h-10 w-10 rounded-full text-sm font-bold transition-colors ${
                          active ? "bg-accent-strong text-white" : "bg-raised/70 text-ink hover:bg-raised"
                        }`}
                      >
                        {choice}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={question.key === null}
                    onClick={() => setKey(index, null)}
                    className={`h-10 rounded-full px-3 text-xs font-semibold ${
                      question.key === null ? "bg-prio-medium-tint text-prio-medium" : "text-muted hover:bg-raised"
                    }`}
                  >
                    {question.key === null ? "Sem gabarito" : "Anular"}
                  </button>
                </div>
              </div>
              <div className="min-w-0 flex-1 pl-11 lg:pl-0">
                <DescriptorPicker
                  question={question.number}
                  options={options}
                  selected={question.descriptorCodes}
                  onChange={(descriptorCodes) =>
                    update({ questions: assessment.questions.map((q, i) => (i === index ? { ...q, descriptorCodes } : q)) })
                  }
                />
              </div>
            </li>
          ))}
        </ol>
        {missing.length > 0 && (
          <p className="caption">
            Sem descritor: {missing.length === assessment.questions.length ? "nenhuma questão tem descritor ainda" : `questões ${missing.join(", ")}`}. A
            correção funciona, mas a análise por descritores fica incompleta.
          </p>
        )}
      </section>

      {assessment.matrix === "custom" && (
        <section aria-labelledby={`${id}-proprios`} className="glass flex flex-col gap-3 rounded-2xl p-4">
          <h2 id={`${id}-proprios`} className="section-title">
            Descritores da escola · {SUBJECT_LABELS[assessment.subject]}
          </h2>
          <div className="grid gap-2 sm:grid-cols-[8rem_12rem_1fr_auto]">
            <input
              aria-label="Código do descritor"
              value={custom.code}
              onChange={(e) => setCustom({ ...custom, code: e.target.value.slice(0, 16) })}
              placeholder="Código (ex.: LP05)"
              className={FIELD}
            />
            <input
              aria-label="Tema do descritor"
              value={custom.topic}
              onChange={(e) => setCustom({ ...custom, topic: e.target.value.slice(0, 80) })}
              placeholder="Tema (opcional)"
              className={FIELD}
            />
            <input
              aria-label="Descrição do descritor"
              value={custom.text}
              onChange={(e) => setCustom({ ...custom, text: e.target.value.slice(0, 300) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomDescriptor();
              }}
              placeholder="Descrição curta"
              className={FIELD}
            />
            <Button variant="depth" onClick={addCustomDescriptor} disabled={!custom.code.trim() || !custom.text.trim()}>
              Adicionar
            </Button>
          </div>
          {options.length > 0 && (
            <ul className="flex flex-col gap-1">
              {options.map((d) => (
                <li key={d.code} className="flex items-start gap-2 text-sm">
                  <span className="w-16 shrink-0 font-semibold">{d.code}</span>
                  <span className="min-w-0 flex-1 text-muted">{d.text}</span>
                  <IconButton
                    aria-label={`Excluir o descritor ${d.code}`}
                    className={DELETE_BUTTON}
                    onClick={() =>
                      update({
                        customDescriptors: assessment.customDescriptors.filter(
                          (other) => !(other.code === d.code && other.subject === d.subject),
                        ),
                      })
                    }
                  >
                    <TrashIcon />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby={`${id}-alunos`} className="glass flex flex-col gap-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${id}-alunos`} className="section-title">
            Alunos ({assessment.roster.length})
          </h2>
          {classroom && (
            <Button
              variant="depth"
              disabled={newFromClass === 0}
              onClick={() => update({ roster: mergeRoster(assessment.roster, classroom.students) })}
            >
              {newFromClass > 0 ? `Trazer ${newFromClass} do cadastro da turma` : "Lista igual ao cadastro"}
            </Button>
          )}
        </div>
        <p className="caption">
          Cada aluno recebe um número fixo nesta avaliação, impresso no código do cartão. Alunos novos entram no fim da
          lista; quem já estava mantém o número, então cartões já impressos continuam valendo.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <label className="sr-only" htmlFor={`${id}-nomes`}>
            Adicionar alunos, um nome por linha
          </label>
          <textarea
            id={`${id}-nomes`}
            value={pastedNames}
            onChange={(e) => setPastedNames(e.target.value)}
            rows={3}
            placeholder="Adicionar alunos: um nome por linha"
            className="glass w-full rounded-xl px-3 py-2 text-sm sm:max-w-md"
          />
          <Button
            variant="secondary"
            disabled={parseNameList(pastedNames).length === 0}
            onClick={() => {
              update({
                roster: mergeRoster(
                  assessment.roster,
                  parseNameList(pastedNames).map((name) => ({ id: null, name, rollNumber: null })),
                ),
              });
              setPastedNames("");
            }}
          >
            Adicionar nomes
          </Button>
        </div>
        {assessment.roster.length > 0 && (
          <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {assessment.roster.map((entry) => (
              <li key={entry.slot} className="flex gap-2">
                <span className="w-7 shrink-0 text-right tabular-nums text-muted">{entry.slot}</span>
                <span className="min-w-0 truncate">{entry.name}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
