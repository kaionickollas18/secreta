import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  applyMention,
  encodeMentions,
  mentionTrigger,
  suggestMentions,
  type MentionOption,
} from "../../utils/mentions";
import { MESSAGE_MAX, validateMessage } from "../../utils/messages";
import { Button } from "../ui/Button";
import { SendIcon } from "../ui/Icons";
import { EmojiPicker } from "./EmojiPicker";

interface MessageComposerProps {
  placeholder: string;
  /** Com texto, o campo fica desligado e o motivo aparece no lugar da dica. */
  blocked?: string;
  /** Pessoas (`@`) e tarefas (`#`) que podem ser marcadas. */
  mentionOptions: MentionOption[];
  /** Devolve a mensagem de erro, ou `null` se deu certo. */
  onSend: (text: string) => Promise<string | null>;
}

/** Campo de escrever: Enter envia, `@` sugere pessoas, `#` sugere tarefas, e há um botão de emojis. */
export function MessageComposer({ placeholder, blocked, mentionOptions, onSend }: MessageComposerProps) {
  const [draft, setDraft] = useState("");
  const [caret, setCaret] = useState(0);
  const [picks, setPicks] = useState<MentionOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [highlight, setHighlight] = useState(0);
  /** Posição do `@`/`#` cujas sugestões a pessoa fechou com Esc. */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const listId = useId();

  const trigger = useMemo(() => mentionTrigger(draft, caret), [draft, caret]);
  const suggestions = useMemo(
    () => (trigger && trigger.start !== dismissedAt ? suggestMentions(mentionOptions, trigger) : []),
    [trigger, dismissedAt, mentionOptions],
  );
  const listOpen = suggestions.length > 0;
  const active = Math.min(highlight, suggestions.length - 1);

  // Depois de inserir uma marcação ou um emoji, o cursor vai para logo depois dele.
  useEffect(() => {
    const field = fieldRef.current;
    const position = pendingCaret.current;
    if (!field || position === null) return;
    pendingCaret.current = null;
    field.focus();
    field.setSelectionRange(position, position);
    setCaret(position);
  }, [draft]);

  function update(text: string, position: number) {
    setDraft(text);
    setCaret(position);
    setHighlight(0);
  }

  function pick(option: MentionOption) {
    if (!trigger) return;
    const next = applyMention(draft, trigger, caret, option);
    pendingCaret.current = next.caret;
    setPicks((current) => [...current.filter((p) => !(p.kind === option.kind && p.id === option.id)), option]);
    update(next.text, next.caret);
  }

  function insertEmoji(emoji: string) {
    const next = draft.slice(0, caret) + emoji + draft.slice(caret);
    if (next.length > MESSAGE_MAX) return;
    pendingCaret.current = caret + emoji.length;
    update(next, caret + emoji.length);
  }

  async function submit() {
    const result = validateMessage(encodeMentions(draft, picks));
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError(null);
    setSending(true);
    const failure = await onSend(result.value);
    setSending(false);
    if (failure) setError(failure);
    else {
      update("", 0);
      setPicks([]);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (listOpen) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlight((active + step + suggestions.length) % suggestions.length);
        return;
      }
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        const option = suggestions[active];
        if (option) {
          event.preventDefault();
          pick(option);
          return;
        }
      }
      if (event.key === "Escape") {
        // Fecha só a lista; o Esc não chega a fechar outra coisa da página.
        event.preventDefault();
        event.stopPropagation();
        setDismissedAt(trigger?.start ?? null);
        return;
      }
    }
    // Enter envia; Shift+Enter quebra a linha.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!sending) void submit();
    }
  }

  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <form onSubmit={handleSubmit} noValidate className="relative border-t border-line p-3">
      {listOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label={trigger?.sigil === "#" ? "Tarefas para marcar" : "Pessoas para marcar"}
          className="absolute bottom-full left-3 right-3 z-20 mb-1 max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-xl sm:right-auto sm:w-80"
        >
          {suggestions.map((option, index) => (
            <li
              key={`${option.kind}-${option.id}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              // Sem tirar o foco do campo de escrever.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(option);
              }}
              onMouseEnter={() => setHighlight(index)}
              className={`cursor-pointer rounded-xl px-3 py-2 ${index === active ? "bg-accent-soft" : ""}`}
            >
              <span className="block truncate text-sm font-semibold">
                {option.kind === "user" ? "@" : "#"}
                {option.label}
              </span>
              {option.hint && <span className="block truncate text-xs text-muted">{option.hint}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="sr-only" aria-live="polite">
        {listOpen
          ? `${suggestions.length} ${suggestions.length === 1 ? "sugestão" : "sugestões"}. Use as setas e Enter para escolher.`
          : ""}
      </p>

      <div className="flex items-end gap-2">
        <EmojiPicker onPick={insertEmoji} disabled={Boolean(blocked)} />
        <label htmlFor="message-body" className="sr-only">
          Escrever mensagem
        </label>
        <textarea
          ref={fieldRef}
          id="message-body"
          rows={2}
          value={draft}
          maxLength={MESSAGE_MAX}
          placeholder={placeholder}
          disabled={Boolean(blocked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "message-error" : "message-hint"}
          aria-autocomplete="list"
          aria-controls={listOpen ? listId : undefined}
          aria-activedescendant={listOpen ? optionId(active) : undefined}
          onChange={(e) => update(e.target.value, e.target.selectionStart)}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
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
          Enter envia · Shift+Enter quebra a linha · @ marca uma pessoa · # marca uma tarefa · Win + . abre os emojis
        </p>
      )}
    </form>
  );
}
