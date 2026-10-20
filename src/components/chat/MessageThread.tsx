import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { ThreadMessage } from "../../types/chat";
import { messageArrivals } from "../../utils/arrivals";
import { assigneeColor } from "../../utils/assignees";
import { mentionsUser, type MentionOption } from "../../utils/mentions";
import { groupByDay, timeLabel } from "../../utils/messages";
import { IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { LockIcon, TrashIcon } from "../ui/Icons";
import { MessageComposer } from "./MessageComposer";
import { RichText, type MentionResolver } from "./RichText";

interface MessageThreadProps {
  /** Nome da conversa para leitores de tela (ex.: "Mensagens do mural"). */
  label: string;
  messages: ThreadMessage[];
  status: "idle" | "loading" | "ready" | "error";
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  /** Aviso fixo no alto da conversa (regras do canal). */
  notice?: ReactNode;
  /** Mostra que só as mensagens mais recentes foram carregadas. */
  truncated?: boolean;
  placeholder: string;
  /** Com texto, o campo de escrever fica desligado e o motivo aparece no lugar da dica. */
  blocked?: string;
  /** Devolve a mensagem de erro, ou `null` se deu certo. */
  onSend: (text: string) => Promise<string | null>;
  onDelete: (message: ThreadMessage) => void;
  /** Quem está lendo: as mensagens que marcam essa pessoa ficam em destaque. */
  currentUserId: string;
  /** Pessoas e tarefas que podem ser marcadas com `@` e `#`. */
  mentionOptions: MentionOption[];
  resolver: MentionResolver;
  /** Quem lê esta conversa, quando não é a escola toda (conversa direta). */
  audience?: string[];
}

/** Uma conversa: as mensagens por dia e o campo de escrever. Serve para todos os canais. */
export function MessageThread({
  label,
  messages,
  status,
  onRetry,
  emptyTitle,
  emptyDescription,
  notice,
  truncated = false,
  placeholder,
  blocked,
  onSend,
  onDelete,
  currentUserId,
  mentionOptions,
  resolver,
  audience,
}: MessageThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupByDay(messages), [messages]);

  // Ao abrir e a cada mensagem nova: rola até o fim.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (status === "ready") messageArrivals.prime();
  }, [status]);

  return (
    <>
      <div role="log" aria-label={label} aria-live="polite" tabIndex={0} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {notice}
        {status === "loading" && <p className="text-sm text-muted">Carregando mensagens…</p>}
        {status === "error" && (
          <p role="alert" className="text-sm text-prio-urgent">
            Não foi possível carregar as mensagens.{" "}
            <button className="underline" onClick={onRetry}>
              Tentar de novo
            </button>
          </p>
        )}
        {status === "ready" && messages.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}
        {truncated && <p className="mx-auto text-center caption">Mostrando só as mensagens mais recentes.</p>}

        {groups.map((group) => (
          <section key={`${group.label}-${group.messages[0]?.id}`} aria-label={group.label}>
            <p className="mb-2 text-center text-xs font-medium text-muted">{group.label}</p>
            <ul className="space-y-2">
              {group.messages.map((message) => {
                const color = assigneeColor(message.colorSeed ?? message.author);
                const time = timeLabel(message.createdAt);
                const mentioned = !message.mine && message.body !== null && mentionsUser(message.body, currentUserId);
                const authorClass = `text-xs font-semibold ${message.mine ? "text-accent-light" : color.text}`;
                return (
                  <li
                    key={message.id}
                    className={`flex ${message.mine ? "justify-end" : "justify-start"} ${
                      messageArrivals.observe(message.id, "sent") === "new" ? "animate-enter" : ""
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl border px-3 py-2 sm:max-w-[70%] ${
                        message.mine
                          ? "border-accent/40 bg-accent-soft"
                          : mentioned
                            ? "border-magenta/70 bg-surface ring-1 ring-magenta/50"
                            : "border-line bg-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {message.authorId && !message.mine ? (
                          <button
                            type="button"
                            aria-label={`Ver perfil de ${message.author}`}
                            onClick={() => message.authorId && resolver.onOpenUser(message.authorId)}
                            className={`${authorClass} underline-offset-2 hover:underline focus-visible:underline`}
                          >
                            {message.author}
                          </button>
                        ) : (
                          <span className={authorClass}>{message.author}</span>
                        )}
                        {mentioned && (
                          <span className="rounded-full bg-magenta/25 px-1.5 text-2xs font-semibold text-ink">
                            marcou você
                          </span>
                        )}
                        <time dateTime={message.createdAt} className="text-2xs text-muted">
                          {time}
                        </time>
                        {message.canDelete && (
                          <IconButton
                            aria-label={`Apagar mensagem de ${message.author} das ${time}`}
                            className="ml-auto !h-7 !w-7"
                            onClick={() => onDelete(message)}
                          >
                            <TrashIcon />
                          </IconButton>
                        )}
                      </div>
                      {message.body === null ? (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm italic text-muted">
                          <LockIcon />
                          Mensagem protegida que este aparelho não consegue abrir.
                        </p>
                      ) : (
                        <p className="mt-0.5 whitespace-pre-line break-words text-base leading-normal">
                          <RichText body={message.body} resolver={resolver} currentUserId={currentUserId} />
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <div ref={endRef} />
      </div>

      <MessageComposer
        placeholder={placeholder}
        blocked={blocked}
        mentionOptions={mentionOptions}
        audience={audience}
        onSend={onSend}
      />
    </>
  );
}
