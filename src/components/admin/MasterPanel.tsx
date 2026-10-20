import { useEffect, useState, type FormEvent } from "react";
import { useDirectoryStore } from "../../store/directoryStore";
import { useToastStore } from "../../store/toastStore";
import type { Member, School } from "../../types/directory";
import { secretaryOf, sortSchools } from "../../utils/directory";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { PlusIcon } from "../ui/Icons";
import { Modal } from "../ui/Modal";
import { ActiveBadge } from "./ActiveBadge";
import { MemberForm } from "./MemberForm";

type ModalState =
  | { kind: "createSchool" }
  | { kind: "renameSchool"; school: School }
  | { kind: "editSecretary"; member: Member }
  | null;

function RenameSchoolForm({
  school,
  onSubmit,
  onCancel,
}: {
  school: School;
  onSubmit: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(school.name);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 120) {
      setError("O nome da escola deve ter de 2 a 120 caracteres.");
      return;
    }
    setSubmitting(true);
    setError(await onSubmit(trimmed));
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="school-name" className="mb-1 block text-sm font-medium">
          Nome da escola
        </label>
        <input
          id="school-name"
          data-autofocus
          value={name}
          maxLength={120}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "school-name-error" : undefined}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm aria-[invalid=true]:border-prio-urgent"
        />
        {error && (
          <p id="school-name-error" role="alert" className="mt-1 text-sm text-prio-urgent">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

/** Painel do Master: escolas e o secretário de cada uma. */
export function MasterPanel() {
  const { schools, members, status, load, createSchool, renameSchool, deleteSchool, updateMember } =
    useDirectoryStore();
  const pushToast = useToastStore((s) => s.push);
  const [modal, setModal] = useState<ModalState>(null);
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!schoolToDelete) return;
    const error = await deleteSchool(schoolToDelete.id);
    setSchoolToDelete(null);
    pushToast(error ? { tone: "error", message: error } : { tone: "success", message: "Escola excluída." });
  }

  /** Fecha o modal e avisa quando deu certo; devolve o erro para o formulário mostrar. */
  function finish(error: string | null, message: string): string | null {
    if (!error) {
      setModal(null);
      pushToast({ tone: "success", message });
    }
    return error;
  }

  const sorted = sortSchools(schools);

  return (
    <section aria-labelledby="h-schools" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="h-schools" className="panel-title">
          Escolas
        </h2>
        <Button variant="primary" onClick={() => setModal({ kind: "createSchool" })}>
          <PlusIcon />
          Nova escola
        </Button>
      </div>

      {status === "loading" && (
        <p role="status" className="text-sm text-muted">
          Carregando…
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-prio-urgent">
          Não foi possível carregar os dados.{" "}
          <button className="underline" onClick={() => void load()}>
            Tentar de novo
          </button>
        </p>
      )}
      {status === "ready" && sorted.length === 0 && (
        <EmptyState title="Nenhuma escola cadastrada" description="Cadastre a primeira escola e o secretário responsável." />
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {sorted.map((school) => {
          const secretary = secretaryOf(school.id, members);
          return (
            <li key={school.id} className="glass rounded-3xl p-4">
              <h3 className="section-title">{school.name}</h3>
              {secretary ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span>
                    <span className="text-muted">Secretário:</span> {secretary.fullName}
                  </span>
                  <ActiveBadge active={secretary.active} />
                  <span className="w-full text-xs text-muted">{secretary.email}</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">Sem secretário cadastrado.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => setModal({ kind: "renameSchool", school })}>Renomear</Button>
                {secretary && (
                  <Button onClick={() => setModal({ kind: "editSecretary", member: secretary })}>
                    Editar secretário
                  </Button>
                )}
                <Button variant="danger" onClick={() => setSchoolToDelete(school)}>
                  Excluir
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal open={modal?.kind === "createSchool"} title="Nova escola" onClose={() => setModal(null)}>
        <p className="mb-4 text-sm text-muted">Cadastre a escola e o secretário que vai administrá-la.</p>
        <MemberForm
          mode="create"
          withSchoolName
          submitLabel="Cadastrar"
          onCancel={() => setModal(null)}
          onSubmit={async (v) =>
            finish(
              await createSchool(v.schoolName, { fullName: v.fullName, email: v.email, password: v.password }),
              "Escola e secretário cadastrados.",
            )
          }
        />
      </Modal>

      <Modal open={modal?.kind === "renameSchool"} title="Renomear escola" onClose={() => setModal(null)}>
        {modal?.kind === "renameSchool" && (
          <RenameSchoolForm
            school={modal.school}
            onCancel={() => setModal(null)}
            onSubmit={async (name) => finish(await renameSchool(modal.school.id, name), "Escola renomeada.")}
          />
        )}
      </Modal>

      <Modal open={modal?.kind === "editSecretary"} title="Editar secretário" onClose={() => setModal(null)}>
        {modal?.kind === "editSecretary" && (
          <MemberForm
            key={modal.member.id}
            mode="edit"
            initial={{ fullName: modal.member.fullName, email: modal.member.email, active: modal.member.active }}
            submitLabel="Salvar"
            onCancel={() => setModal(null)}
            onSubmit={async (v) =>
              finish(
                await updateMember(modal.member.id, {
                  fullName: v.fullName,
                  password: v.password,
                  active: v.active,
                }),
                "Secretário atualizado.",
              )
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        open={schoolToDelete !== null}
        title="Excluir escola?"
        message={
          schoolToDelete
            ? `“${schoolToDelete.name}” será excluída junto com o secretário, os auxiliares e todas as tarefas. Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        onConfirm={() => void handleDelete()}
        onCancel={() => setSchoolToDelete(null)}
      />
    </section>
  );
}
