import { useId, useState } from "react";
import type { ReinforcementEntry } from "../../types/grade";
import { Button } from "../ui/Button";

interface ReinforcementPanelProps {
  /** O aluno no reforço, ou `null` se ele não está. */
  entry: ReinforcementEntry | null;
  /** Põe no reforço (ou troca o motivo). Devolve a mensagem de erro, ou `null`. */
  onSave: (note: string) => Promise<string | null>;
  onRemove: () => Promise<string | null>;
}

const formatDay = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
};

/**
 * Turma de reforço, no perfil do aluno: adicionar (com um motivo opcional), trocar o motivo e
 * tirar. Os alunos do reforço vão ter as avaliações bimestrais acompanhadas mais de perto.
 */
export function ReinforcementPanel({ entry, onSave, onRemove }: ReinforcementPanelProps) {
  const noteId = useId();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setNote(entry?.note ?? "");
    setError(null);
    setEditing(true);
  }

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const message = await action();
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    setEditing(false);
    setConfirming(false);
  }

  return (
    <section
      aria-label="Turma de reforço"
      className={`flex flex-col gap-3 rounded-2xl border p-3 ${
        entry ? "border-prio-medium/50 bg-prio-medium-tint" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {entry ? "Na turma de reforço" : "Turma de reforço"}
          </p>
          <p className="caption">
            {entry
              ? `Desde ${formatDay(entry.addedAt)}${entry.addedByName ? `, por ${entry.addedByName}` : ""}.`
              : "Acompanhe de perto as avaliações bimestrais deste aluno."}
          </p>
          {entry?.note && !editing && (
            <p className="mt-1 text-sm">
              <span className="text-muted">Motivo:</span> {entry.note}
            </p>
          )}
        </div>
        {!editing && !confirming && (
          <div className="flex flex-wrap gap-2">
            {entry ? (
              <>
                <Button onClick={startEditing}>
                  {entry.note ? "Editar motivo" : "Adicionar motivo"}
                </Button>
                <Button onClick={() => setConfirming(true)}>Tirar do reforço</Button>
              </>
            ) : (
              <Button variant="primary" onClick={startEditing}>
                Adicionar à turma de reforço
              </Button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => onSave(note));
          }}
        >
          <label htmlFor={noteId} className="text-sm font-medium">
            Motivo ou foco do reforço <span className="text-muted">(opcional)</span>
          </label>
          <textarea
            id={noteId}
            value={note}
            maxLength={300}
            rows={2}
            data-autofocus
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: Matemática: frações e operações"
            className="glass w-full rounded-2xl px-3 py-2 text-sm placeholder:text-muted"
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditing(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Salvando…" : entry ? "Salvar motivo" : "Adicionar ao reforço"}
            </Button>
          </div>
        </form>
      )}

      {confirming && (
        <div
          role="group"
          aria-label="Confirmar"
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <p className="text-sm">
            Tirar este aluno da turma de reforço? As notas dele não mudam.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setConfirming(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void run(onRemove)} disabled={busy}>
              {busy ? "Tirando…" : "Tirar do reforço"}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-prio-urgent">
          {error}
        </p>
      )}
    </section>
  );
}
