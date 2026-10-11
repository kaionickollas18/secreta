import { useEffect, useState } from "react";
import { useDirectoryStore } from "../../store/directoryStore";
import { useToastStore } from "../../store/toastStore";
import type { Member } from "../../types/directory";
import { assistantsOf, filterMembers } from "../../utils/directory";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { PlusIcon } from "../ui/Icons";
import { Modal } from "../ui/Modal";
import { ActiveBadge } from "./ActiveBadge";
import { MemberForm } from "./MemberForm";

type ModalState = { kind: "create" } | { kind: "edit"; member: Member } | null;

/** Área do Secretário: cadastro dos auxiliares administrativos da escola. */
export function AssistantsPanel() {
  const { members, status, load, createAssistant, updateMember, deleteMember } = useDirectoryStore();
  const pushToast = useToastStore((s) => s.push);
  const [modal, setModal] = useState<ModalState>(null);
  const [toDelete, setToDelete] = useState<Member | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void load();
  }, [load]);

  const all = assistantsOf(members);
  const shown = filterMembers(all, query);

  function finish(error: string | null, message: string): string | null {
    if (!error) {
      setModal(null);
      pushToast({ tone: "success", message });
    }
    return error;
  }

  async function handleDelete() {
    if (!toDelete) return;
    const error = await deleteMember(toDelete.id);
    setToDelete(null);
    pushToast(error ? { tone: "error", message: error } : { tone: "success", message: "Auxiliar excluído." });
  }

  return (
    <section aria-labelledby="h-assistants" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="h-assistants" className="panel-title">
          Auxiliares administrativos
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {all.length > 0 && (
            <input
              type="search"
              aria-label="Buscar auxiliar"
              placeholder="Buscar auxiliar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="glass min-h-[40px] w-full rounded-full px-4 text-sm placeholder:text-muted sm:w-56"
            />
          )}
          <Button variant="primary" onClick={() => setModal({ kind: "create" })}>
            <PlusIcon />
            Novo auxiliar
          </Button>
        </div>
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
      {status === "ready" && all.length === 0 && (
        <EmptyState title="Nenhum auxiliar cadastrado" description="Cadastre quem vai ajudar nas tarefas da escola." />
      )}
      {status === "ready" && all.length > 0 && shown.length === 0 && (
        <p className="text-sm text-muted">Nenhum auxiliar encontrado para essa busca.</p>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map((member) => (
          <li key={member.id} className="glass rounded-3xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="section-title">{member.fullName}</h3>
              <ActiveBadge active={member.active} />
            </div>
            <p className="caption">{member.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => setModal({ kind: "edit", member })}>Editar</Button>
              <Button variant="danger" onClick={() => setToDelete(member)}>
                Excluir
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={modal?.kind === "create"} title="Novo auxiliar" onClose={() => setModal(null)}>
        <MemberForm
          mode="create"
          submitLabel="Cadastrar"
          onCancel={() => setModal(null)}
          onSubmit={async (v) =>
            finish(
              await createAssistant({ fullName: v.fullName, email: v.email, password: v.password }),
              "Auxiliar cadastrado.",
            )
          }
        />
      </Modal>

      <Modal open={modal?.kind === "edit"} title="Editar auxiliar" onClose={() => setModal(null)}>
        {modal?.kind === "edit" && (
          <MemberForm
            key={modal.member.id}
            mode="edit"
            initial={modal.member}
            submitLabel="Salvar"
            onCancel={() => setModal(null)}
            onSubmit={async (v) =>
              finish(
                await updateMember(modal.member.id, {
                  fullName: v.fullName,
                  password: v.password,
                  active: v.active,
                }),
                "Auxiliar atualizado.",
              )
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir auxiliar?"
        message={
          toDelete
            ? `${toDelete.fullName} perderá o acesso e será removido(a) dos responsáveis das tarefas. Esta ação não pode ser desfeita. Para apenas bloquear o acesso, use Editar e desmarque “Acesso ativo”.`
            : ""
        }
        confirmLabel="Excluir"
        onConfirm={() => void handleDelete()}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
