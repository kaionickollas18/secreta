import type { ReactNode } from "react";
import type { ChannelId } from "../../types/chat";

export interface ConversationItem {
  id: ChannelId;
  /** Nome exibido: "Geral", "Anônimo" ou o sobrenome do colega. */
  label: string;
  /** Linha de apoio (para quem é a conversa). */
  hint: string;
  /** Foto do colega ou o ícone do canal. */
  picture: ReactNode;
  unread: number;
  /** Há mensagem nova que marca a pessoa com `@`. */
  mentioned?: boolean;
}

interface ConversationListProps {
  items: ConversationItem[];
  active: ChannelId | null;
  onSelect: (id: ChannelId) => void;
  className?: string;
}

/** Lista para escolher com quem conversar: os canais de todos e, abaixo, cada colega. */
export function ConversationList({ items, active, onSelect, className = "" }: ConversationListProps) {
  return (
    <nav aria-label="Conversas" className={className}>
      <ul className="space-y-1">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => onSelect(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-colors ${
                  current ? "border-accent/50 bg-accent-soft" : "border-transparent hover:bg-raised/60"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center">{item.picture}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.label}</span>
                  <span className="block truncate text-xs text-muted">{item.hint}</span>
                </span>
                {item.mentioned && (
                  <span className="shrink-0">
                    <span
                      aria-hidden="true"
                      className="block h-5 w-5 rounded-full bg-magenta text-center text-xs font-bold leading-5 text-canvas"
                    >
                      @
                    </span>
                    <span className="sr-only">(você foi marcado)</span>
                  </span>
                )}
                {item.unread > 0 && (
                  <span className="shrink-0">
                    <span
                      aria-hidden="true"
                      className="block min-w-[20px] rounded-full bg-prio-urgent px-1.5 text-center text-2xs font-bold tabular-nums leading-5 text-canvas"
                    >
                      {item.unread > 99 ? "99+" : item.unread}
                    </span>
                    <span className="sr-only">
                      ({item.unread} {item.unread === 1 ? "mensagem nova" : "mensagens novas"})
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
