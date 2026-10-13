import { useMemo, useState } from "react";
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS } from "../../constants/board";
import type { Member } from "../../types/directory";
import type { Task } from "../../types/task";
import { formatDueDate, todayISO } from "../../utils/date";
import { ageOn, displayName, schoolTeam } from "../../utils/directory";
import { roleLabel } from "../../utils/roles";
import { openTasksOf } from "../../utils/tasks";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";

interface TeamSectionProps {
  members: Member[];
  schoolId: string;
  /** Quem está logado: aparece marcado como "você". */
  currentUserId: string;
  tasks: Task[];
  className?: string;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line py-2 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

/** Perfil de uma pessoa da escola, só para leitura. */
function MemberProfile({ member, tasks }: { member: Member; tasks: Task[] }) {
  const open = useMemo(() => openTasksOf(tasks, member.id), [tasks, member.id]);
  const age = member.birthDate ? ageOn(member.birthDate, todayISO()) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar id={member.id} name={member.lastName} url={member.avatarUrl} className="h-28 w-28 text-4xl ring-2 ring-line" />
        {member.nickname && <p className="text-xl font-bold leading-tight">{member.nickname}</p>}
        <p className={member.nickname ? "text-sm text-muted" : "text-lg font-semibold"}>{member.fullName}</p>
        <p className="flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-light">
            {roleLabel(member)}
          </span>
          {!member.active && (
            <span className="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold text-muted">Inativo</span>
          )}
        </p>
      </div>

      <dl>
        <Fact label="Apelido">{member.nickname ?? <span className="font-normal text-muted">Não informado</span>}</Fact>
        <Fact label="Nascimento">
          {member.birthDate ? (
            <>
              {formatDueDate(member.birthDate)}
              {age !== null && <span className="font-normal text-muted"> · {age} anos</span>}
            </>
          ) : (
            <span className="font-normal text-muted">Não informado</span>
          )}
        </Fact>
        {member.email && (
          <Fact label="E-mail">
            <a href={`mailto:${member.email}`} className="text-accent-light underline">
              {member.email}
            </a>
          </Fact>
        )}
      </dl>

      <section aria-label="Tarefas em aberto">
        <h3 className="mb-2 text-sm font-medium">
          Tarefas em aberto <span className="tabular-nums text-muted">({open.length})</span>
        </h3>
        {open.length === 0 ? (
          <p className="caption">Nenhuma tarefa em aberto.</p>
        ) : (
          <ul className="space-y-2">
            {open.map((task) => (
              <li key={task.id} className="rounded-xl border border-line bg-canvas/40 px-3 py-2">
                <p className="break-words card-title">{task.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${PRIORITY_STYLES[task.priority].badge}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  <span>{STATUS_LABELS[task.status]}</span>
                  {task.dueDate && <span className="tabular-nums">Vence {formatDueDate(task.dueDate)}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Pessoas da escola. Clicar em alguém abre o perfil dela. */
export function TeamSection({ members, schoolId, currentUserId, tasks, className = "" }: TeamSectionProps) {
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
        {opened && <MemberProfile member={opened} tasks={tasks} />}
      </Modal>
    </section>
  );
}
