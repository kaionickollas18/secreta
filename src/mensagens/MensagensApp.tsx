import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, IconButton } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { SendIcon, TrashIcon } from "../components/ui/Icons";
import { ToastViewport } from "../components/ui/ToastViewport";
import { useAuthStore } from "../store/authStore";
import { useMessageStore } from "../store/messageStore";
import { useToastStore } from "../store/toastStore";
import type { Message } from "../types/message";
import { messageArrivals } from "../utils/arrivals";
import { assigneeColor } from "../utils/assignees";
import { groupByDay, MESSAGE_MAX, MESSAGE_PAGE, timeLabel, validateMessage } from "../utils/messages";
import { whenPageShown } from "../utils/pageLifecycle";
import { canModerateMessages, effectiveRole } from "../utils/roles";

/** Mural da escola. O AppShell carrega e acompanha as mensagens; aqui exibimos e enviamos. */
export default function MensagensApp() {
  const profile = useAuthStore((s) => s.profile);
  const { messages, status, load, send, remove, markSeen } = useMessageStore();
  const pushToast = useToastStore((s) => s.push);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [toDelete, setToDelete] = useState<Message | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const userId = profile?.id;
  const groups = useMemo(() => groupByDay(messages), [messages]);

  // Ao abrir e a cada mensagem nova: rola até o fim e registra como lido.
  useEffect(() => {
    if (!userId) return;
    endRef.current?.scrollIntoView?.({ block: "end" });
    return whenPageShown(() => markSeen(userId));
  }, [messages.length, userId, markSeen]);

  useEffect(() => {
    if (status === "ready") messageArrivals.prime();
  }, [status]);

  if (!profile?.schoolId) return null;
  const schoolId = profile.schoolId;
  const moderator = canModerateMessages(effectiveRole(profile));

  async function submit() {
    const result = validateMessage(draft);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError(null);
    setSending(true);
    const failure = await send(schoolId, result.value);
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

  async function handleDelete() {
    if (!toDelete) return;
    const failure = await remove(toDelete.id);
    setToDelete(null);
    pushToast(failure ? { tone: "error", message: failure } : { tone: "success", message: "Mensagem apagada." });
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-5rem)] max-w-[900px] flex-col gap-4 px-4 py-5 sm:px-6 md:h-dvh">
      <header>
        <h1 className="page-title">
          Mensagens
        </h1>
        <p className="page-lede">
          Mural da escola: tudo o que for escrito aqui é visto pelo secretário e por todos os auxiliares.
        </p>
      </header>

      <main className="glass flex min-h-0 flex-1 flex-col rounded-3xl">
        <div
          role="log"
          aria-label="Mensagens do mural"
          aria-live="polite"
          tabIndex={0}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        >
          {status === "loading" && <p className="text-sm text-muted">Carregando mensagens…</p>}
          {status === "error" && (
            <p role="alert" className="text-sm text-prio-urgent">
              Não foi possível carregar as mensagens.{" "}
              <button className="underline" onClick={() => void load(profile.id)}>
                Tentar de novo
              </button>
            </p>
          )}
          {status === "ready" && messages.length === 0 && (
            <EmptyState title="Nenhuma mensagem ainda" description="Escreva a primeira mensagem para a equipe." />
          )}
          {messages.length >= MESSAGE_PAGE && (
            <p className="mx-auto text-center caption">Mostrando as {MESSAGE_PAGE} mensagens mais recentes.</p>
          )}

          {groups.map((group) => (
            <section key={`${group.label}-${group.messages[0]?.id}`} aria-label={group.label}>
              <p className="mb-2 text-center text-xs font-medium text-muted">{group.label}</p>
              <ul className="space-y-2">
                {group.messages.map((message) => {
                  const mine = message.senderId === profile.id;
                  const color = assigneeColor(message.senderId ?? message.senderName);
                  return (
                    <li
                      key={message.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"} ${
                        messageArrivals.observe(message.id, "sent") === "new" ? "animate-enter" : ""
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl border px-3 py-2 sm:max-w-[70%] ${
                          mine ? "border-accent/40 bg-accent-soft" : "border-line bg-surface"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${mine ? "text-accent-light" : color.text}`}>
                            {mine ? "Você" : message.senderName}
                          </span>
                          <time dateTime={message.createdAt} className="text-2xs text-muted">
                            {timeLabel(message.createdAt)}
                          </time>
                          {(mine || moderator) && (
                            <IconButton
                              aria-label={`Apagar mensagem de ${mine ? "você" : message.senderName} das ${timeLabel(message.createdAt)}`}
                              className="ml-auto !h-7 !w-7"
                              onClick={() => setToDelete(message)}
                            >
                              <TrashIcon />
                            </IconButton>
                          )}
                        </div>
                        <p className="mt-0.5 whitespace-pre-line break-words text-base leading-normal">{message.body}</p>
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
              placeholder="Escreva uma mensagem para a equipe"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "message-error" : "message-hint"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent"
            />
            <Button type="submit" variant="primary" disabled={sending} className="min-h-[44px]">
              <SendIcon />
              {sending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
          {error ? (
            <p id="message-error" role="alert" className="mt-1 text-sm text-prio-urgent">
              {error}
            </p>
          ) : (
            <p id="message-hint" className="mt-1 hidden caption sm:block">
              Enter envia · Shift+Enter quebra a linha
            </p>
          )}
        </form>
      </main>

      <ConfirmDialog
        open={toDelete !== null}
        title="Apagar mensagem?"
        message="A mensagem some para toda a escola e não pode ser recuperada."
        confirmLabel="Apagar"
        onConfirm={() => void handleDelete()}
        onCancel={() => setToDelete(null)}
      />
      <ToastViewport />
    </div>
  );
}
