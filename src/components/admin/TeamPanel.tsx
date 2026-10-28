import { useEffect, useState } from "react";
import { useDirectoryStore } from "../../store/directoryStore";
import { useToastStore } from "../../store/toastStore";
import type { Member } from "../../types/directory";
import { displayName, filterMembers, managedMembers } from "../../utils/directory";
import { ELEVATED_LABEL, ROLE_LABELS, type ManagedRole } from "../../utils/roles";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { PlusIcon } from "../ui/Icons";
import { Modal } from "../ui/Modal";
import { ActiveBadge } from "./ActiveBadge";
import { MemberForm } from "./MemberForm";

type ModalState = { kind: "create" } | { kind: "edit"; member: Member } | null;

const managedRoleOf = (member: Member): ManagedRole => (member.role === "teacher" ? "teacher" : "assistant");

/** Área do Secretário: cadastro e perfil dos assistentes administrativos e dos professores. */
export function TeamPanel() {
  const { members, status, load, createMember, updateMember, deleteMember } = useDirectoryStore();
  const pushToast = useToastStore((s) => s.push);
  const [modal, setModal] = useState<ModalState>(null);
  const [toDelete, setToDelete] = useState<Member | null>(null);
  const [toElevate, setToElevate] = useState<Member | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void load();
  }, [load]);

  const all = managedMembers(members);
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
    pushToast(error ? { tone: "error", message: error } : { tone: "success", message: "Pessoa excluída." });
  }

  /** Dá ou retira o acesso especial. Conceder pede confirmação antes; retirar é imediato. */
  async function setElevated(member: Member, elevated: boolean) {
    setToElevate(null);
    const error = await updateMember(member.id, { elevated });
    pushToast(
      error
        ? { tone: "error", message: error }
        : {
            tone: "success",
            message: elevated
              ? `${member.fullName} agora tem acesso de secretário.`
              : `${member.fullName} voltou ao acesso de assistente.`,
          },
    );
  }

  return (
    <section aria-labelledby="h-team-admin" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="h-team-admin" className="panel-title">
          Assistentes e professores
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {all.length > 0 && (
            <input
              type="search"
              aria-label="Buscar pessoa"
              placeholder="Buscar pessoa"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="glass min-h-[40px] w-full rounded-full px-4 text-sm placeholder:text-muted sm:w-56"
            />
          )}
          <Button variant="primary" onClick={() => setModal({ kind: "create" })}>
            <PlusIcon />
            Nova pessoa
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
        <EmptyState
          title="Ninguém cadastrado ainda"
          description="Cadastre os assistentes da secretaria e os professores da escola."
        />
      )}
      {status === "ready" && all.length > 0 && shown.length === 0 && (
        <p className="text-sm text-muted">Ninguém encontrado para essa busca.</p>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map((member) => (
          <li key={member.id} className="glass rounded-3xl p-4">
            <div className="flex items-start gap-3">
              <Avatar id={member.id} name={member.lastName} url={member.avatarUrl} className="h-12 w-12 text-base" />
              <div className="min-w-0 flex-1">
                <h3 className="break-words section-title">{member.fullName}</h3>
                <p className="truncate caption">
                  {member.email}
                  {member.nickname && ` · ${displayName(member)}`}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-medium">
                    {ROLE_LABELS[member.role]}
                  </span>
                  {member.elevated && (
                    <span className="rounded-full border border-accent/50 bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-light">
                      {ELEVATED_LABEL}
                    </span>
                  )}
                  <ActiveBadge active={member.active} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button aria-label={`Editar ${member.fullName}`} onClick={() => setModal({ kind: "edit", member })}>
                Editar
              </Button>
              {member.role === "assistant" &&
                (member.elevated ? (
                  <Button
                    aria-label={`Retirar o acesso de secretário de ${member.fullName}`}
                    onClick={() => void setElevated(member, false)}
                  >
                    Retirar acesso de secretário
                  </Button>
                ) : (
                  <Button
                    aria-label={`Dar acesso de secretário a ${member.fullName}`}
                    onClick={() => setToElevate(member)}
                  >
                    Dar acesso de secretário
                  </Button>
                ))}
              <Button variant="danger" aria-label={`Excluir ${member.fullName}`} onClick={() => setToDelete(member)}>
                Excluir
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={modal?.kind === "create"} title="Nova pessoa" onClose={() => setModal(null)}>
        <MemberForm
          mode="create"
          staff
          submitLabel="Cadastrar"
          onCancel={() => setModal(null)}
          onSubmit={async (v) =>
            finish(
              await createMember({ fullName: v.fullName, email: v.email, password: v.password, role: v.role }),
              `${ROLE_LABELS[v.role]} cadastrado(a).`,
            )
          }
        />
      </Modal>

      <Modal
        open={modal?.kind === "edit"}
        title={modal?.kind === "edit" ? `Editar ${modal.member.fullName}` : ""}
        onClose={() => setModal(null)}
      >
        {modal?.kind === "edit" && (
          <MemberForm
            key={modal.member.id}
            mode="edit"
            staff
            initial={{
              fullName: modal.member.fullName,
              email: modal.member.email,
              active: modal.member.active,
              role: managedRoleOf(modal.member),
              lastName: modal.member.lastName,
              nickname: modal.member.nickname ?? "",
              birthDate: modal.member.birthDate ?? "",
              hasPhoto: Boolean(modal.member.avatarUrl),
            }}
            submitLabel="Salvar"
            onCancel={() => setModal(null)}
            onSubmit={async (v) =>
              finish(
                await updateMember(modal.member.id, {
                  fullName: v.fullName,
                  lastName: v.lastName,
                  nickname: v.nickname,
                  birthDate: v.birthDate,
                  email: v.email,
                  role: v.role,
                  password: v.password,
                  active: v.active,
                  removePhoto: v.removePhoto,
                }),
                "Perfil atualizado.",
              )
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toElevate !== null}
        title="Dar acesso de secretário?"
        message={
          toElevate
            ? `${toElevate.fullName} poderá criar e excluir tarefas, definir responsáveis, concluir e aprovar pedidos, criar lembretes, configurar a base do dashboard e apagar mensagens do mural. Não poderá cadastrar pessoas nem mudar este acesso. Você pode retirar o acesso quando quiser.`
            : ""
        }
        confirmLabel="Dar acesso"
        confirmVariant="primary"
        onConfirm={() => toElevate && void setElevated(toElevate, true)}
        onCancel={() => setToElevate(null)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title={toDelete ? `Excluir ${ROLE_LABELS[toDelete.role].toLowerCase()}?` : "Excluir?"}
        message={
          toDelete
            ? `${toDelete.fullName} perderá o acesso${toDelete.role === "assistant" ? " e será removido(a) dos responsáveis das tarefas" : ""}. Esta ação não pode ser desfeita. Para apenas bloquear o acesso, use Editar e desmarque “Acesso ativo”.`
            : ""
        }
        confirmLabel="Excluir"
        onConfirm={() => void handleDelete()}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
