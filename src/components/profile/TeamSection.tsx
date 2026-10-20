import { useMemo, useState } from "react";
import type { Member } from "../../types/directory";
import type { Task } from "../../types/task";
import { displayName, schoolTeam } from "../../utils/directory";
import { roleLabel } from "../../utils/roles";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";
import { MemberProfile } from "./MemberProfile";

interface TeamSectionProps {
  members: Member[];
  schoolId: string;
  /** Quem está logado: aparece marcado como "você". */
  currentUserId: string;
  tasks: Task[];
  /** Abre a conversa com a pessoa (não aparece para si mesmo nem para inativos). */
  onStartChat?: (member: Member) => void;
  /** Mostra as tarefas em aberto de cada pessoa (só para quem vê o quadro). */
  showTasks?: boolean;
  className?: string;
}

/** Pessoas da escola. Clicar em alguém abre o perfil dela. */
export function TeamSection({
  members,
  schoolId,
  currentUserId,
  tasks,
  onStartChat,
  showTasks = true,
  className = "",
}: TeamSectionProps) {
  const team = useMemo(() => schoolTeam(members, schoolId), [members, schoolId]);
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = team.find((m) => m.id === openId);

  return (
    <section className={className} aria-labelledby="h-team">
      <h2 id="h-team" className="section-title">
        Pessoas da escola
      </h2>
      <p className="caption mt-1">Toque em alguém para ver o perfil.</p>
      {team.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Carregando a equipe…</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {team.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                aria-label={`Ver perfil de ${member.fullName}`}
                onClick={() => setOpenId(member.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border border-line bg-canvas/40 p-2.5 text-left transition-colors hover:bg-raised/60 ${
                  member.active ? "" : "opacity-60"
                }`}
              >
                <Avatar id={member.id} name={member.lastName} url={member.avatarUrl} className="h-12 w-12 text-base" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {displayName(member)}
                    {member.id === currentUserId && <span className="font-normal text-muted"> (você)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {roleLabel(member)}
                    {!member.active && " · Inativo"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={opened !== undefined} title={opened ? `Perfil de ${displayName(opened)}` : ""} onClose={() => setOpenId(null)}>
        {opened && (
          <MemberProfile
            member={opened}
            tasks={tasks}
            showTasks={showTasks}
            onStartChat={
              onStartChat && opened.active && opened.id !== currentUserId ? () => onStartChat(opened) : undefined
            }
          />
        )}
      </Modal>
    </section>
  );
}
