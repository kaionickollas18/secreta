import type { Note } from "../../types/note";

interface NoteChecklistProps {
  note: Note;
  onToggle: (note: Note, itemId: string, done: boolean) => void;
}

/** Itens de uma lista de marcação. O item marcado fica riscado. */
export function NoteChecklist({ note, onToggle }: NoteChecklistProps) {
  return (
    <ul aria-label={`Itens de ${note.title}`} className="space-y-0.5">
      {note.items.map((item) => (
        <li key={item.id}>
          <label className="flex min-h-[36px] cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-raised/50">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={item.done}
              onChange={(e) => onToggle(note, item.id, e.target.checked)}
            />
            <span className={`min-w-0 break-words text-sm ${item.done ? "text-muted line-through" : ""}`}>
              {item.text}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
