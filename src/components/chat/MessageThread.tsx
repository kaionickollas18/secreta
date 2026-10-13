import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { ThreadMessage } from "../../types/chat";
import { messageArrivals } from "../../utils/arrivals";
import { assigneeColor } from "../../utils/assignees";
import { groupByDay, MESSAGE_MAX, timeLabel, validateMessage } from "../../utils/messages";
import { Button, IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { LockIcon, SendIcon, TrashIcon } from "../ui/Icons";

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
}: MessageThreadProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupByDay(messages), [messages]);

  // Ao abrir e a cada mensagem nova: rola até o fim.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (status === "ready") messageArrivals.prime();
  }, [status]);

  async function submit() {
    const result = validateMessage(draft);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError(null);
    setSending(true);
    const failure = await onSend(result.value);
    setSending(false);
    if (failure) setError(failure);
    else setDraft("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra a linha.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!sending) void submit();
    }
  }

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
                return (
                  <li
                    key={message.id}
                    className={`flex ${message.mine ? "justify-end" : "justify-start"} ${
                      messageArrivals.observe(message.id, "sent") === "new" ? "animate-enter" : ""
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl border px-3 py-2 sm:max-w-[70%] ${
                        message.mine ? "border-accent/40 bg-accent-soft" : "border-line bg-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${message.mine ? "text-accent-light" : color.text}`}>
                          {message.author}
                        </span>
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
                        <p className="mt-0.5 whitespace-pre-line break-words text-base leading-normal">{message.body}</p>
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

      <form onSubmit={handleSubmit} noValidate className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <label htmlFor="message-body" className="sr-only">
            Escrever mensagem
          </label>
          <textarea
            id="message-body"
            rows={2}
            value={draft}
            maxLength={MESSAGE_MAX}
            placeholder={placeholder}
            disabled={Boolean(blocked)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "message-error" : "message-hint"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 disabled:opacity-50 aria-[invalid=true]:border-prio-urgent"
          />
          <Button type="submit" variant="primary" disabled={sending || Boolean(blocked)} className="min-h-[44px]">
            <SendIcon />
            {sending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
        {error ? (
          <p id="message-error" role="alert" className="mt-1 text-sm text-prio-urgent">
            {error}
          </p>
        ) : blocked ? (
          <p id="message-hint" className="mt-1 caption">
            {blocked}
          </p>
        ) : (
          <p id="message-hint" className="mt-1 hidden caption sm:block">
            Enter envia · Shift+Enter quebra a linha
          </p>
        )}
      </form>
    </>
  );
}
