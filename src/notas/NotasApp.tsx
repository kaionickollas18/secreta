import { useEffect, useMemo, useState } from "react";
import { NoteCard } from "../components/notes/NoteCard";
import { NoteForm, type LinkOption } from "../components/notes/NoteForm";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { PlusIcon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { ToastViewport } from "../components/ui/ToastViewport";
import { useAuthStore } from "../store/authStore";
import { useNoteStore } from "../store/noteStore";
import { useReminderStore } from "../store/reminderStore";
import { useTaskStore } from "../store/taskStore";
import { useToastStore } from "../store/toastStore";
import type { Note, NoteLink } from "../types/note";
import { linkFromSearch, linkToValue, pendingItems, sortNotes } from "../utils/notes";
import { canDeleteNote, effectiveRole } from "../utils/roles";

type ModalState = { mode: "create"; link?: NoteLink } | { mode: "edit"; note: Note } | null;

/** Chegando por "Nova nota" de uma tarefa ou lembrete, o formulário já abre com o vínculo. */
function initialModal(): ModalState {
  const link = linkFromSearch(window.location.search);
  return link ? { mode: "create", link } : null;
}

/** Notas da escola: textos e listas de marcação, soltas ou vinculadas a tarefa ou lembrete. */
export default function NotasApp() {
  const profile = useAuthStore((s) => s.profile);
  const { notes, status, load, watch, save, remove, toggleItem } = useNoteStore();
  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.load);
  const reminders = useReminderStore((s) => s.reminders);
  const pushToast = useToastStore((s) => s.push);
  const [modal, setModal] = useState<ModalState>(initialModal);
  const [toDelete, setToDelete] = useState<Note | null>(null);

  useEffect(() => {
    void load();
    void loadTasks();
    return watch();
  }, [load, loadTasks, watch]);

  const sorted = useMemo(() => sortNotes(notes), [notes]);
  const { taskOptions, reminderOptions, labels } = useMemo(() => {
    const byTitle = (a: LinkOption, b: LinkOption) => a.label.localeCompare(b.label, "pt-BR");
    const taskOptions = tasks
      .map((t) => ({ value: linkToValue({ type: "task", id: t.id }), label: t.title }))
      .sort(byTitle);
    const reminderOptions = reminders
      .map((r) => ({ value: linkToValue({ type: "reminder", id: r.id }), label: r.title }))
      .sort(byTitle);
    const labels = new Map([
      ...taskOptions.map((o) => [o.value, `Tarefa: ${o.label}`] as const),
      ...reminderOptions.map((o) => [o.value, `Lembrete: ${o.label}`] as const),
    ]);
    return { taskOptions, reminderOptions, labels };
  }, [tasks, reminders]);

  if (!profile?.schoolId) return null;
  const schoolId = profile.schoolId;
  const role = effectiveRole(profile);
  const pending = pendingItems(notes);

  function closeModal() {
    setModal(null);
    // Tira o vínculo do endereço, para a página não reabrir o formulário ao recarregar.
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }

  function handleToggle(note: Note, itemId: string, done: boolean) {
    void toggleItem(note.id, itemId, done).then((error) => {
      if (error) pushToast({ tone: "error", message: error });
    });
  }

  async function handleDelete() {
    if (!toDelete) return;
    const error = await remove(toDelete.id);
    setToDelete(null);
    pushToast(error ? { tone: "error", message: error } : { tone: "success", message: "Nota excluída." });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Notas</h1>
          <p className="page-lede">
            {pending > 0
              ? `${pending} ${pending === 1 ? "item ainda falta" : "itens ainda faltam"} nas listas.`
              : "Anotações e listas de marcação da secretaria."}
          </p>
        </div>
        <Button variant="primary" onClick={() => setModal({ mode: "create" })}>
          <PlusIcon />
          Nova nota
        </Button>
      </header>

      <main className="flex-1">
        {status === "loading" && (
          <>
            <p role="status" className="sr-only">
              Carregando notas…
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="hidden h-40 rounded-2xl xl:block" />
            </div>
          </>
        )}
        {status === "error" && (
          <p role="alert" className="text-sm text-prio-urgent">
            Não foi possível carregar as notas.{" "}
            <button className="underline" onClick={() => void load()}>
              Tentar de novo
            </button>
          </p>
        )}
        {status === "ready" && sorted.length === 0 && (
          <EmptyState
            title="Nenhuma nota ainda"
            description="Crie uma anotação ou uma lista do que está faltando e marque os itens conforme forem resolvidos."
          />
        )}
        <ul className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              linkLabel={note.link ? (labels.get(linkToValue(note.link)) ?? "Vinculada") : undefined}
              canDelete={canDeleteNote(role, note.authorId === profile.id)}
              onToggle={handleToggle}
              onEdit={(n) => setModal({ mode: "edit", note: n })}
              onDelete={setToDelete}
            />
          ))}
        </ul>
      </main>

      <Modal open={modal !== null} title={modal?.mode === "edit" ? "Editar nota" : "Nova nota"} onClose={closeModal}>
        {modal && (
          <NoteForm
            key={modal.mode === "edit" ? modal.note.id : "new"}
            note={modal.mode === "edit" ? modal.note : undefined}
            initialLink={modal.mode === "create" ? modal.link : undefined}
            tasks={taskOptions}
            reminders={reminderOptions}
            onCancel={closeModal}
            onSubmit={async (input) => {
              const editing = modal.mode === "edit";
              const error = await save(schoolId, input, editing ? modal.note.id : undefined);
              if (!error) {
                closeModal();
                pushToast({ tone: "success", message: editing ? "Nota atualizada." : "Nota criada." });
              }
              return error;
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir nota?"
        message={toDelete ? `“${toDelete.title}” será apagada para toda a escola. Esta ação não pode ser desfeita.` : ""}
        confirmLabel="Excluir"
        onConfirm={() => void handleDelete()}
        onCancel={() => setToDelete(null)}
      />
      <ToastViewport />
    </div>
  );
}
