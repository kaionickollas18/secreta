import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "./components/board/Board";
import { FilterBar } from "./components/board/FilterBar";
import { HistoryModal } from "./components/board/HistoryModal";
import type { CardActions } from "./components/task/TaskCard";
import { TaskModal, type TaskModalState } from "./components/task/TaskModal";
import { Button } from "./components/ui/Button";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";
import { PlusIcon } from "./components/ui/Icons";
import { ToastViewport } from "./components/ui/ToastViewport";
import { REQUESTED_MESSAGE } from "./constants/board";
import { useBoardAccess } from "./hooks/useBoardAccess";
import { useFilteredTasks } from "./hooks/useFilteredTasks";
import { useDirectoryStore } from "./store/directoryStore";
import { useTaskStore } from "./store/taskStore";
import { useToastStore } from "./store/toastStore";
import type { Task, TaskInput, TaskStatus } from "./types/task";

export default function App() {
  const { total, visible, grouped, totals, filtersActive, doneCount, pendingCount } = useFilteredTasks();
  const { role, schoolId, canManage, canApprove } = useBoardAccess();
  const status = useTaskStore((s) => s.status);
  const load = useTaskStore((s) => s.load);
  const watch = useTaskStore((s) => s.watch);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const setPriority = useTaskStore((s) => s.setPriority);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const moveTask = useTaskStore((s) => s.moveTask);
  const respondCompletion = useTaskStore((s) => s.respondCompletion);
  const loadDirectory = useDirectoryStore((s) => s.load);
  const pushToast = useToastStore((s) => s.push);

  const [modal, setModal] = useState<TaskModalState>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    void load();
    void loadDirectory();
    return watch();
  }, [load, loadDirectory, watch]);

  const openCreate = useCallback((status: TaskStatus = "todo") => {
    setModal({ mode: "create", status });
  }, []);

  /** Mostra o erro (se houver) ou a mensagem de sucesso. Devolve `true` quando deu certo. */
  const report = useCallback(
    (error: string | null, success?: string): boolean => {
      if (error) pushToast({ tone: "error", message: error });
      else if (success) pushToast({ tone: "success", message: success });
      return !error;
    },
    [pushToast],
  );

  async function handleSubmit(input: TaskInput) {
    if (modal?.mode === "edit") {
      const { error, outcome } = await updateTask(modal.task.id, input, role);
      if (report(error, outcome === "requested" ? REQUESTED_MESSAGE : "Alterações salvas.")) {
        setModal(null);
      }
    } else if (schoolId) {
      if (report(await addTask(input, schoolId), "Tarefa criada.")) setModal(null);
    }
  }

  async function handleConfirmDelete() {
    if (!taskToDelete) return;
    const error = await deleteTask(taskToDelete.id);
    setTaskToDelete(null);
    report(error, "Tarefa excluída.");
  }

  const actions = useMemo<CardActions>(
    () => ({
      onEdit: (task) => setModal({ mode: "edit", task }),
      onDelete: setTaskToDelete,
      onPriorityChange: (id, priority) => void setPriority(id, priority).then((e) => report(e)),
      onRequestCompletion: (task) =>
        void moveTask(task.id, "done", undefined, role).then(({ error }) =>
          report(error, REQUESTED_MESSAGE),
        ),
      onRespond: (task, approve) =>
        void respondCompletion(task.id, approve).then((e) =>
          report(e, approve ? "Tarefa concluída." : "Tarefa devolvida para ajustes."),
        ),
    }),
    [moveTask, report, respondCompletion, role, setPriority],
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-5 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">
            SECRETA
          </h1>
          <p className="page-lede">
            {total === 0
              ? canManage
                ? "Crie sua primeira tarefa para começar."
                : "Nenhuma tarefa no quadro ainda."
              : `${doneCount} de ${total} tarefas concluídas`}
            {canApprove && pendingCount > 0 && (
              <span className="font-semibold text-prio-medium">
                {" "}
                · {pendingCount} aguardando sua aprovação
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="depth" onClick={() => setHistoryOpen(true)}>
            Histórico
          </Button>
          {canManage && (
            <Button variant="primary" onClick={() => openCreate()}>
              <PlusIcon />
              Nova tarefa
            </Button>
          )}
        </div>
      </header>

      {status === "error" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-md border border-prio-medium bg-prio-medium-tint px-4 py-3 text-sm text-prio-medium"
        >
          <span>Não foi possível carregar as tarefas. Verifique sua conexão.</span>
          <Button variant="ghost" onClick={() => void load()}>
            Tentar de novo
          </Button>
        </div>
      )}
      {status === "loading" && (
        <p role="status" className="sr-only">
          Carregando tarefas…
        </p>
      )}

      <FilterBar visible={visible} total={total} filtersActive={filtersActive} />

      <main className="flex-1">
        <Board
          grouped={grouped}
          totals={totals}
          filtersActive={filtersActive}
          onAdd={openCreate}
          actions={actions}
        />
      </main>

      <TaskModal state={modal} onSubmit={(input) => void handleSubmit(input)} onClose={() => setModal(null)} />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <ConfirmDialog
        open={taskToDelete !== null}
        title="Excluir tarefa?"
        message={
          taskToDelete
            ? `“${taskToDelete.title}” será removida do quadro e não poderá ser recuperada. Se ela já foi concluída, o registro continua no Histórico.`
            : ""
        }
        confirmLabel="Excluir"
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setTaskToDelete(null)}
      />
      <ToastViewport />
    </div>
  );
}
