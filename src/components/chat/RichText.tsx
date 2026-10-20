import { useMemo } from "react";
import { parseMessage } from "../../utils/mentions";

/** Nomes atuais para as marcações. `undefined`: a pessoa ou a tarefa não existe (mais). */
export interface MentionResolver {
  userName: (id: string) => string | undefined;
  taskTitle: (id: string) => string | undefined;
  onOpenUser: (id: string) => void;
  onOpenTask: (id: string) => void;
}

interface RichTextProps {
  body: string;
  resolver: MentionResolver;
  /** Quem está lendo: a marcação da própria pessoa ganha destaque. */
  currentUserId: string;
}

const CHIP = "rounded-md px-1 font-semibold underline-offset-2 hover:underline focus-visible:underline";

/**
 * Texto de uma mensagem com as marcações `@pessoa` e `#tarefa` como botões. O nome exibido é
 * o do cadastro, nunca o que veio escrito na mensagem; marcação de id desconhecido vira texto.
 */
export function RichText({ body, resolver, currentUserId }: RichTextProps) {
  const segments = useMemo(() => parseMessage(body), [body]);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === "text") return <span key={index}>{segment.text}</span>;
        if (segment.kind === "user") {
          const name = resolver.userName(segment.id);
          if (!name) return <span key={index}>@{segment.label}</span>;
          const me = segment.id === currentUserId;
          return (
            <button
              key={index}
              type="button"
              aria-label={`Ver perfil de ${name}${me ? " (você)" : ""}`}
              onClick={() => resolver.onOpenUser(segment.id)}
              className={`${CHIP} ${me ? "bg-magenta/25 text-ink" : "bg-accent-soft text-accent-light"}`}
            >
              @{name}
            </button>
          );
        }
        const title = resolver.taskTitle(segment.id);
        if (!title) return <span key={index}>#{segment.label}</span>;
        return (
          <button
            key={index}
            type="button"
            aria-label={`Ver tarefa ${title}`}
            onClick={() => resolver.onOpenTask(segment.id)}
            className={`${CHIP} bg-raised text-ink`}
          >
            #{title}
          </button>
        );
      })}
    </>
  );
}
