import type { Task, TaskInput, TaskStatus } from "../../types/task";
import { Modal } from "../ui/Modal";
import { TaskForm } from "./TaskForm";

export type TaskModalState =
  | { mode: "create"; status: TaskStatus }
  | { mode: "edit"; task: Task }
  | null;

interface TaskModalProps {
  state: TaskModalState;
  onSubmit: (input: TaskInput) => void;
  onClose: () => void;
}

export function TaskModal({ state, onSubmit, onClose }: TaskModalProps) {
  return (
    <Modal
      open={state !== null}
      title={state?.mode === "edit" ? "Editar tarefa" : "Nova tarefa"}
      onClose={onClose}
    >
      {state && (
        <TaskForm
          key={state.mode === "edit" ? state.task.id : `new-${state.status}`}
          task={state.mode === "edit" ? state.task : undefined}
          defaultStatus={state.mode === "create" ? state.status : undefined}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
