import { useMemo } from "react";
import { useNoteStore } from "../../store/noteStore";
import { useToastStore } from "../../store/toastStore";
import type { Note, NoteLink } from "../../types/note";
import { newNoteHref, noteProgress, notesLinkedTo } from "../../utils/notes";
import { NoteIcon, PlusIcon } from "../ui/Icons";
import { NoteChecklist } from "./NoteChecklist";

interface LinkedNotesProps {
  link: NoteLink;
  /** Mostra o atalho para criar uma nota já vinculada (e o bloco mesmo sem notas). */
  showAdd?: boolean;
  className?: string;
}

/** Notas vinculadas a uma tarefa ou a um lembrete, com os itens marcáveis ali mesmo. */
export function LinkedNotes({ link, showAdd = false, className = "" }: LinkedNotesProps) {
  const notes = useNoteStore((s) => s.notes);
  const toggleItem = useNoteStore((s) => s.toggleItem);
  const pushToast = useToastStore((s) => s.push);
  const linked = useMemo(() => notesLinkedTo(notes, link), [notes, link]);

  if (linked.length === 0 && !showAdd) return null;

  function handleToggle(note: Note, itemId: string, done: boolean) {
    void toggleItem(note.id, itemId, done).then((error) => {
      if (error) pushToast({ tone: "error", message: error });
    });
  }

  return (
    <section aria-label="Notas vinculadas" className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <span className="text-muted">
            <NoteIcon />
          </span>
          Notas
        </h3>
        {showAdd && (
          <a
            href={newNoteHref(link)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-accent-light hover:bg-raised hover:text-ink"
          >
            <PlusIcon />
            Nova nota
          </a>
        )}
      </div>
      {linked.length === 0 ? (
        <p className="caption">Nenhuma nota vinculada.</p>
      ) : (
        <ul className="space-y-2">
          {linked.map((note) => {
            const { done, total } = noteProgress(note);
            return (
              <li key={note.id} className="rounded-xl border border-line bg-canvas/40 p-2">
                <p className="flex items-baseline justify-between gap-2 px-2 pt-1">
                  <span className="min-w-0 break-words card-title">{note.title}</span>
                  {total > 0 && (
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {done} de {total}
                    </span>
                  )}
                </p>
                {note.kind === "text" ? (
                  note.body && (
                    <p className="whitespace-pre-line break-words px-2 pb-1 pt-1 text-sm text-muted">{note.body}</p>
                  )
                ) : (
                  <NoteChecklist note={note} onToggle={handleToggle} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
