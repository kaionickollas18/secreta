import type { Note } from "../../types/note";
import { formatDateTime } from "../../utils/history";
import { noteProgress } from "../../utils/notes";
import { DELETE_BUTTON, EDIT_BUTTON, IconButton } from "../ui/Button";
import { PencilIcon, TrashIcon } from "../ui/Icons";
import { NoteChecklist } from "./NoteChecklist";

interface NoteCardProps {
  note: Note;
  /** "Tarefa: …" ou "Lembrete: …"; `undefined` sem vínculo. */
  linkLabel?: string;
  /** Só quem escreveu ou o Secretário exclui. */
  canDelete: boolean;
  onToggle: (note: Note, itemId: string, done: boolean) => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export function NoteCard({ note, linkLabel, canDelete, onToggle, onEdit, onDelete }: NoteCardProps) {
  const { done, total } = noteProgress(note);
  const complete = total > 0 && done === total;

  return (
    <li className={`glass flex flex-col gap-3 rounded-2xl p-4 ${complete ? "border-prio-low/30" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="break-words section-title">{note.title}</h3>
          <p className="mt-0.5 caption">
            {note.authorName} · {formatDateTime(note.updatedAt)}
          </p>
        </div>
        <div className="flex shrink-0">
          <IconButton aria-label={`Editar ${note.title}`} className={EDIT_BUTTON} onClick={() => onEdit(note)}>
            <PencilIcon />
          </IconButton>
          {canDelete && (
            <IconButton aria-label={`Excluir ${note.title}`} className={DELETE_BUTTON} onClick={() => onDelete(note)}>
              <TrashIcon />
            </IconButton>
          )}
        </div>
      </div>

      {note.kind === "text" ? (
        note.body && <p className="whitespace-pre-line break-words text-sm text-muted">{note.body}</p>
      ) : (
        <NoteChecklist note={note} onToggle={onToggle} />
      )}

      {(total > 0 || linkLabel) && (
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {total > 0 && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                complete ? "bg-prio-low-tint text-prio-low" : "bg-prio-medium-tint text-prio-medium"
              }`}
            >
              {complete ? "Nada faltando" : `${done} de ${total} · ${total - done === 1 ? "falta 1" : `faltam ${total - done}`}`}
            </span>
          )}
          {linkLabel && (
            <span className="min-w-0 max-w-full truncate rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-light">
              {linkLabel}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
