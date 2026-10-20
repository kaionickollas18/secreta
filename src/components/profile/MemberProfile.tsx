import { useMemo, type ReactNode } from "react";
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS } from "../../constants/board";
import type { Member } from "../../types/directory";
import type { Task } from "../../types/task";
import { formatDueDate, todayISO } from "../../utils/date";
import { ageOn } from "../../utils/directory";
import { roleLabel } from "../../utils/roles";
import { openTasksOf } from "../../utils/tasks";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ChatIcon } from "../ui/Icons";

interface MemberProfileProps {
  member: Member;
  tasks: Task[];
  /** Sem esta ação (o próprio perfil, ou pessoa inativa) o botão "Conversar" não aparece. */
  onStartChat?: () => void;
  /** Tarefas em aberto: só para quem vê o quadro (o professor não vê). */
  showTasks?: boolean;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line py-2 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

/** Perfil de uma pessoa da escola, só para leitura. */
export function MemberProfile({
  member,
  tasks,
  onStartChat,
  showTasks = true,
}: MemberProfileProps) {
  const open = useMemo(() => openTasksOf(tasks, member.id), [tasks, member.id]);
  const age = member.birthDate ? ageOn(member.birthDate, todayISO()) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar
          id={member.id}
          name={member.lastName}
          url={member.avatarUrl}
          className="h-28 w-28 text-4xl ring-2 ring-line"
        />
        {member.nickname && (
          <p className="text-xl font-bold leading-tight">{member.nickname}</p>
        )}
        <p className={member.nickname ? "text-sm text-muted" : "text-lg font-semibold"}>
          {member.fullName}
        </p>
        <p className="flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-light">
            {roleLabel(member)}
          </span>
          {!member.active && (
            <span className="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold text-muted">
              Inativo
            </span>
          )}
        </p>
        {onStartChat && (
          <Button variant="primary" className="mt-1" onClick={onStartChat}>
            <ChatIcon />
            Conversar com {member.lastName}
          </Button>
        )}
      </div>

      <dl>
        <Fact label="Apelido">
          {member.nickname ?? (
            <span className="font-normal text-muted">Não informado</span>
          )}
        </Fact>
        <Fact label="Nascimento">
          {member.birthDate ? (
            <>
              {formatDueDate(member.birthDate)}
              {age !== null && (
                <span className="font-normal text-muted"> · {age} anos</span>
              )}
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

      {showTasks && (
        <section aria-label="Tarefas em aberto">
          <h3 className="mb-2 text-sm font-medium">
            Tarefas em aberto{" "}
            <span className="tabular-nums text-muted">({open.length})</span>
          </h3>
          {open.length === 0 ? (
            <p className="caption">Nenhuma tarefa em aberto.</p>
          ) : (
            <ul className="space-y-2">
              {open.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-line bg-canvas/40 px-3 py-2"
                >
                  <p className="break-words card-title">{task.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span
                      className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${PRIORITY_STYLES[task.priority].badge}`}
                    >
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                    <span>{STATUS_LABELS[task.status]}</span>
                    {task.dueDate && (
                      <span className="tabular-nums">
                        Vence {formatDueDate(task.dueDate)}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
