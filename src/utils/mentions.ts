import { normalizeText } from "./tasks";

/**
 * Marcações nas conversas: `@` marca uma pessoa e `#` marca uma tarefa.
 *
 * No campo de escrever aparece só `@Souza` ou `#Pagar boleto`. Ao enviar, cada marcação
 * escolhida na lista vira um código com o id (`@[Souza](u:<id>)`), que continua valendo se a
 * pessoa ou a tarefa mudar de nome. O texto do código vem de quem escreveu; por isso a tela
 * mostra sempre o nome atual do cadastro e trata como texto comum um id que não existe.
 */

export type MentionKind = "user" | "task";

export interface MentionOption {
  kind: MentionKind;
  id: string;
  /** O que aparece depois do símbolo: sobrenome da pessoa ou título da tarefa. */
  label: string;
  /** Linha de apoio na lista de sugestões (nome completo, coluna da tarefa). */
  hint?: string;
}

export type RichSegment =
  | { kind: "text"; text: string }
  | { kind: MentionKind; id: string; label: string };

export interface MentionTrigger {
  sigil: "@" | "#";
  query: string;
  /** Posição do símbolo no texto. */
  start: number;
}

const SIGIL: Record<MentionKind, "@" | "#"> = { user: "@", task: "#" };
const CODE: Record<MentionKind, string> = { user: "u", task: "t" };
const LABEL_MAX = 120;
const TOKEN = /([@#])\[([^\]\n]{1,120})\]\((u|t):([\w-]{1,64})\)/g;

/** Rótulo seguro para o código: sem colchetes nem quebras de linha, e curto. */
function cleanLabel(label: string): string {
  return label.replace(/[[\]\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, LABEL_MAX);
}

/** Como a marcação aparece no campo de escrever: `@Souza`. */
export function mentionText(option: Pick<MentionOption, "kind" | "label">): string {
  return `${SIGIL[option.kind]}${cleanLabel(option.label)}`;
}

export function mentionToken(option: Pick<MentionOption, "kind" | "id" | "label">): string {
  return `${SIGIL[option.kind]}[${cleanLabel(option.label)}](${CODE[option.kind]}:${option.id})`;
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/**
 * Troca no texto cada marcação escolhida pelo código. Só vale a ocorrência inteira
 * (`@Silva` não pega o começo de `@Silvana`); se a pessoa apagou a marcação, ela some.
 * As mais longas primeiro, para `#Pagar boleto` não ser lida como `#Pagar`.
 */
export function encodeMentions(text: string, picks: MentionOption[]): string {
  let result = text;
  const ordered = [...picks].sort((a, b) => mentionText(b).length - mentionText(a).length);
  for (const pick of ordered) {
    const shown = mentionText(pick);
    let from = 0;
    while (from <= result.length) {
      const index = result.indexOf(shown, from);
      if (index === -1) break;
      const next = result.charAt(index + shown.length);
      if (next && WORD_CHAR.test(next)) {
        from = index + shown.length;
        continue;
      }
      result = result.slice(0, index) + mentionToken(pick) + result.slice(index + shown.length);
      break;
    }
  }
  return result;
}

/** Separa o texto da mensagem em trechos comuns e marcações. */
export function parseMessage(body: string): RichSegment[] {
  const segments: RichSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(TOKEN)) {
    const [whole, , label = "", code, id = ""] = match;
    const index = match.index ?? 0;
    if (index > last) segments.push({ kind: "text", text: body.slice(last, index) });
    segments.push({ kind: code === "u" ? "user" : "task", id, label });
    last = index + whole.length;
  }
  if (last < body.length) segments.push({ kind: "text", text: body.slice(last) });
  return segments;
}

/** A mensagem marca esta pessoa? */
export function mentionsUser(body: string, userId: string): boolean {
  return parseMessage(body).some((s) => s.kind === "user" && s.id === userId);
}

/**
 * Se o cursor está logo depois de `@algo` ou `#algo` (no começo ou depois de um espaço),
 * devolve o que está sendo procurado. Senão, `null`.
 */
export function mentionTrigger(text: string, caret: number): MentionTrigger | null {
  const match = /(^|\s)([@#])([^\s@#[\]]{0,40})$/u.exec(text.slice(0, caret));
  if (!match) return null;
  const query = match[3] ?? "";
  return { sigil: match[2] === "#" ? "#" : "@", query, start: caret - query.length - 1 };
}

/** Sugestões do tipo certo que contêm o que foi digitado; as que começam com ele vêm antes. */
export function suggestMentions(
  options: MentionOption[],
  trigger: MentionTrigger,
  limit = 6,
): MentionOption[] {
  const kind: MentionKind = trigger.sigil === "@" ? "user" : "task";
  const needle = normalizeText(trigger.query);
  const scored = options.flatMap((option) => {
    if (option.kind !== kind) return [];
    const label = normalizeText(option.label);
    if (label.startsWith(needle)) return [{ option, score: 0 }];
    if (normalizeText(`${option.label} ${option.hint ?? ""}`).includes(needle)) return [{ option, score: 1 }];
    return [];
  });
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.option);
}

/**
 * Pessoas marcadas no texto que não leem esta conversa (numa direta, quem não é um dos dois).
 * Sem `audience`, a conversa é da escola toda e ninguém fica de fora.
 */
export function mentionsOutside(text: string, picks: MentionOption[], audience?: string[]): MentionOption[] {
  if (!audience) return [];
  return picks.filter((p) => p.kind === "user" && !audience.includes(p.id) && text.includes(mentionText(p)));
}

/** Coloca a marcação escolhida no lugar do que estava sendo digitado. */
export function applyMention(
  text: string,
  trigger: MentionTrigger,
  caret: number,
  option: MentionOption,
): { text: string; caret: number } {
  const inserted = `${mentionText(option)} `;
  const after = text.slice(caret).replace(/^ /, "");
  return {
    text: text.slice(0, trigger.start) + inserted + after,
    caret: trigger.start + inserted.length,
  };
}
