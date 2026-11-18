import { useMemo, useState } from "react";
import { saveGradeImport } from "../../store/gradeApi";
import type { GradeImport, GradeStudent, Segment, Term } from "../../types/grade";
import { planGradeImport } from "../../utils/gradeImport";
import { classDisplayName, isTerm, SEGMENT_SHORT, TERMS, termLabel } from "../../utils/grades";
import type { TextItem } from "../../utils/pdfText";
import { parseReportCards, type ReportCard } from "../../utils/reportCardParser";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { PdfPicker } from "./PdfPicker";

interface GradeImportModalProps {
  /** Segmento do botão que abriu; `null` = fechado. */
  segment: Segment | null;
  schoolId: string;
  schoolYear: number;
  students: GradeStudent[];
  /** Envio anterior do segmento, se houver. */
  previous: GradeImport | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const SEGMENT_NAMES: Record<Segment, string> = { ef1: "EF I", ef2: "EF II" };

/** "1º, 2º e 3º" */
const termList = (terms: Term[]): string => {
  const names = terms.map((term) => `${term}º`);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
};

/** Envio do boletim escolar de um segmento: bimestre, prévia, alunos não encontrados e gravação. */
export function GradeImportModal({
  segment,
  schoolId,
  schoolYear,
  students,
  previous,
  onClose,
  onSaved,
}: GradeImportModalProps) {
  const [term, setTerm] = useState<Term | null>(null);
  const [cards, setCards] = useState<ReportCard[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [register, setRegister] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const plan = useMemo(
    () => (segment && term && cards ? planGradeImport(cards, segment, term, students) : null),
    [segment, term, cards, students],
  );

  function close() {
    if (saving) return;
    setTerm(null);
    setCards(null);
    setSkipped([]);
    setRegister(false);
    setProblem(null);
    onClose();
  }

  function handleRead(items: TextItem[], name: string) {
    const result = parseReportCards(items);
    setFileName(name);
    setRegister(false);
    if (result.cards.length === 0) {
      setCards(null);
      setProblem("Nenhum boletim encontrado. Confira se o arquivo é o “Boletim escolar” tirado do sistema da rede.");
      return;
    }
    setProblem(null);
    setCards(result.cards);
    setSkipped(result.skipped);
  }

  async function save() {
    if (!plan || plan.rows.length + (register ? plan.unmatched.length : 0) === 0) return;
    setSaving(true);
    const result = await saveGradeImport(schoolId, schoolYear, plan, fileName, register);
    setSaving(false);
    if (result.error !== null) {
      setProblem(result.error);
      return;
    }
    const message = `Notas do ${SEGMENT_NAMES[plan.segment]} salvas (${termList(
      TERMS.filter((t) => t <= plan.upToTerm),
    )} bimestre): ${result.data} lançamentos.`;
    setTerm(null);
    setCards(null);
    onSaved(message);
  }

  if (!segment) return null;
  const wrongFile = plan !== null && plan.cards === 0 && plan.otherSegment > 0;
  const registrable = plan?.unmatched.filter((card) => !card.duplicate) ?? [];

  return (
    <Modal open title={`Enviar notas · ${SEGMENT_SHORT[segment]}`} onClose={close}>
      <div className="flex flex-col gap-4">
        <p className="caption">
          Envie o PDF “Boletim escolar” do {SEGMENT_NAMES[segment]}, com todas as turmas. São gravados a média (MD) e as
          faltas (FT) de cada disciplina do 1º até o bimestre escolhido; os bimestres seguintes, mesmo que já estejam no
          arquivo, ficam de fora. Enviar de novo substitui esses bimestres, sem duplicar.
        </p>

        <div>
          <label htmlFor="grade-term" className="mb-1 block text-sm font-medium">
            Bimestre
          </label>
          <select
            id="grade-term"
            value={term ?? ""}
            disabled={saving}
            onChange={(event) => {
              const next = Number(event.target.value);
              setTerm(isTerm(next) ? next : null);
            }}
            className="glass min-h-[44px] w-full rounded-full px-3 text-sm"
          >
            <option value="">Escolha o bimestre</option>
            {TERMS.map((t) => (
              <option key={t} value={t}>
                Até o {termLabel(t)}
              </option>
            ))}
          </select>
        </div>

        <PdfPicker label="Arquivo PDF do boletim" disabled={saving} onRead={handleRead} />
        {problem && (
          <p role="alert" className="text-sm text-prio-urgent">
            {problem}
          </p>
        )}
        {cards && !term && <p className="text-sm">Arquivo lido. Escolha o bimestre para ver a prévia.</p>}

        {plan && wrongFile && (
          <p role="alert" className="text-sm text-prio-urgent">
            Este arquivo não tem boletins do {SEGMENT_NAMES[segment]}. Confira se não é o PDF do outro segmento.
          </p>
        )}

        {plan && !wrongFile && (
          <section aria-label="Prévia das notas" className="flex flex-col gap-3">
            <p className="text-sm">
              <strong>{plan.cards} boletins</strong> em {plan.classes.length}{" "}
              {plan.classes.length === 1 ? "turma" : "turmas"} ({plan.classes.map((c) => classDisplayName(c.name)).join(", ")}),{" "}
              {plan.subjects.length} disciplinas. {plan.matched} {plan.matched === 1 ? "aluno encontrado" : "alunos encontrados"} no
              cadastro; <strong>{plan.rows.length}</strong> lançamentos a gravar ({termList(TERMS.filter((t) => t <= plan.upToTerm))}{" "}
              bimestre).
            </p>
            {plan.ignoredTerms.length > 0 && (
              <p className="text-sm text-prio-medium">
                O arquivo também traz o {termList(plan.ignoredTerms)} bimestre, que não será gravado agora.
              </p>
            )}
            {!plan.termsInFile.includes(plan.upToTerm) && (
              <p className="text-sm text-prio-medium">
                O arquivo ainda não tem médias do {termLabel(plan.upToTerm)}: só as faltas dele serão gravadas.
              </p>
            )}
            {previous && (
              <p className="caption">
                Substitui o envio anterior ({previous.fileName || "sem nome"}, até o {termLabel(previous.upToTerm)}
                {previous.importedByName ? `, por ${previous.importedByName}` : ""}) do 1º ao {termLabel(plan.upToTerm)}.
              </p>
            )}
            {plan.otherSegment > 0 && (
              <p className="caption">{plan.otherSegment} boletins de outro segmento no arquivo ficam de fora.</p>
            )}
            {skipped.length > 0 && <p className="caption">Ignorados: {skipped.join("; ")}.</p>}

            {plan.unmatched.length > 0 && (
              <div className="rounded-2xl border border-prio-urgent/40 bg-prio-urgent-tint p-3">
                <p className="text-sm font-semibold">
                  {plan.unmatched.length}{" "}
                  {plan.unmatched.length === 1 ? "aluno não encontrado" : "alunos não encontrados"} no cadastro
                </p>
                <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-sm">
                  {plan.unmatched.map((card) => (
                    <li key={`${card.className}|${card.name}|${card.registration}`}>
                      {card.name} — {classDisplayName(card.className)}
                      {card.registration ? `, matrícula ${card.registration}` : ""}
                      {card.duplicate ? " (boletim repetido no arquivo)" : ""}
                    </li>
                  ))}
                </ul>
                <p className="caption mt-2">
                  Para resolver, envie antes a lista de matriculados atualizada, ou cadastre estes alunos agora.
                </p>
                {registrable.length > 0 && (
                  <label className="mt-2 flex min-h-[44px] items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={register}
                      onChange={(event) => setRegister(event.target.checked)}
                    />
                    Cadastrar {registrable.length === 1 ? "este aluno" : `estes ${registrable.length} alunos`} e gravar as
                    notas {registrable.length === 1 ? "dele" : "deles"}
                  </label>
                )}
              </div>
            )}
          </section>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!plan || wrongFile || saving || plan.rows.length + (register ? registrable.length : 0) === 0}
            onClick={() => void save()}
          >
            {saving ? "Salvando…" : "Salvar notas"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
