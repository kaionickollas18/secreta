import { useEffect, useMemo, useState } from "react";
import { ReminderCard } from "../components/reminders/ReminderCard";
import { ReminderForm } from "../components/reminders/ReminderForm";
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
import { useToastStore } from "../store/toastStore";
import type { Reminder } from "../types/reminder";
import { reminderStatus, sortByUrgency } from "../utils/reminders";
import { canManageReminders, effectiveRole } from "../utils/roles";

type ModalState = { mode: "create" } | { mode: "edit"; reminder: Reminder } | null;

/** Lembretes da escola. O AppShell já carrega os dados; aqui só exibimos e disparamos ações. */
export default function LembretesApp() {
  const profile = useAuthStore((s) => s.profile);
  const { reminders, doneKeys, status, load, save, remove, setDone } = useReminderStore();
  const pushToast = useToastStore((s) => s.push);
  const [modal, setModal] = useState<ModalState>(null);
  const [toDelete, setToDelete] = useState<Reminder | null>(null);
  const loadNotes = useNoteStore((s) => s.load);
  const watchNotes = useNoteStore((s) => s.watch);

  // Notas vinculadas aparecem nos cartões dos lembretes.
  useEffect(() => {
    void loadNotes();
    return watchNotes();
  }, [loadNotes, watchNotes]);

  const items = useMemo(
    () => sortByUrgency(reminders.map((reminder) => ({ reminder, status: reminderStatus(reminder, doneKeys) }))),
    [reminders, doneKeys],
  );

  if (!profile?.schoolId) return null;
  const schoolId = profile.schoolId;
  const canManage = canManageReminders(effectiveRole(profile));
  const dueCount = items.filter((i) => i.status.state === "active" || i.status.state === "overdue").length;

  async function handleToggle(reminder: Reminder, periodKey: string, done: boolean) {
    const error = await setDone(schoolId, reminder.id, periodKey, done);
    pushToast(
      error
        ? { tone: "error", message: error }
        : { tone: "success", message: done ? "Lembrete marcado como feito." : "Conclusão desfeita." },
    );
  }

  async function handleDelete() {
    if (!toDelete) return;
    const error = await remove(toDelete.id);
    setToDelete(null);
    pushToast(error ? { tone: "error", message: error } : { tone: "success", message: "Lembrete excluído." });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col gap-5 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">
            Lembretes
          </h1>
          <p className="page-lede">
            {dueCount > 0
              ? `${dueCount} ${dueCount === 1 ? "lembrete pede" : "lembretes pedem"} atenção agora.`
              : "Prazos e rotinas que se repetem na secretaria."}
          </p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setModal({ mode: "create" })}>
            <PlusIcon />
            Novo lembrete
          </Button>
        )}
      </header>

      <main className="flex-1">
        {status === "loading" && (
          <>
            <p role="status" className="sr-only">
              Carregando lembretes…
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="hidden h-32 rounded-2xl lg:block" />
              <Skeleton className="hidden h-32 rounded-2xl lg:block" />
            </div>
          </>
        )}
        {status === "error" && (
          <p role="alert" className="text-sm text-prio-urgent">
            Não foi possível carregar os lembretes.{" "}
            <button className="underline" onClick={() => void load()}>
              Tentar de novo
            </button>
          </p>
        )}
        {status === "ready" && items.length === 0 && (
          <EmptyState
            title="Nenhum lembrete ainda"
            description={
              canManage
                ? "Crie lembretes para prazos que se repetem."
                : "O secretário ainda não criou lembretes."
            }
          />
        )}
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map(({ reminder, status: reminderState }) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              status={reminderState}
              canManage={canManage}
              onToggleDone={(r, key, done) => void handleToggle(r, key, done)}
              onEdit={(r) => setModal({ mode: "edit", reminder: r })}
              onDelete={setToDelete}
            />
          ))}
        </ul>
      </main>

      <Modal
        open={modal !== null}
        title={modal?.mode === "edit" ? "Editar lembrete" : "Novo lembrete"}
        onClose={() => setModal(null)}
      >
        {modal && (
          <ReminderForm
            key={modal.mode === "edit" ? modal.reminder.id : "new"}
            reminder={modal.mode === "edit" ? modal.reminder : undefined}
            onCancel={() => setModal(null)}
            onSubmit={async (input) => {
              const editing = modal.mode === "edit";
              const error = await save(schoolId, input, editing ? modal.reminder.id : undefined);
              if (!error) {
                setModal(null);
                pushToast({ tone: "success", message: editing ? "Lembrete atualizado." : "Lembrete criado." });
              }
              return error;
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir lembrete?"
        message={
          toDelete ? `“${toDelete.title}” deixará de aparecer para toda a escola. Esta ação não pode ser desfeita.` : ""
        }
        confirmLabel="Excluir"
        onConfirm={() => void handleDelete()}
        onCancel={() => setToDelete(null)}
      />
      <ToastViewport />
    </div>
  );
}
