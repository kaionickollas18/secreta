import type { AnonymousMessage, ChannelId, ChatKey, DirectMessage } from "../types/chat";

/** Onde o navegador guarda a última visita a cada conversa (para o aviso de não lidas). */
export const chatSeenKey = (userId: string) => `secreta:conversas:visto:${userId}`;

export function dmChannel(peerId: string): ChannelId {
  return `dm:${peerId}`;
}

/** Id do colega de um canal de conversa direta; `null` para Geral e Anônimo. */
export function peerOfChannel(channel: ChannelId): string | null {
  return channel.startsWith("dm:") ? channel.slice(3) : null;
}

/** Mensagens trocadas com um colega, da mais antiga para a mais nova. */
export function conversationWith(messages: DirectMessage[], userId: string, peerId: string): DirectMessage[] {
  return messages
    .filter(
      (m) =>
        (m.senderId === userId && m.recipientId === peerId) || (m.senderId === peerId && m.recipientId === userId),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Qual é a minha chave e qual é a do colega em uma mensagem (depende de quem enviou).
 * As duas ficam gravadas na mensagem para ela continuar legível depois de uma troca de chave.
 */
export function keysOfMessage(message: DirectMessage, userId: string): { mine: string; peer: string } {
  return message.senderId === userId
    ? { mine: message.senderKeyId, peer: message.recipientKeyId }
    : { mine: message.recipientKeyId, peer: message.senderKeyId };
}

export function activeKeyOf(keys: ChatKey[], userId: string): ChatKey | undefined {
  return keys.find((k) => k.userId === userId && k.active);
}

/** Lê o registro de visitas guardado no navegador (dado externo: só aceita texto → texto). */
export function parseSeen(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

/**
 * Mensagens novas por conversa: o que recebi de cada colega e o que os outros escreveram no
 * canal anônimo depois da minha última visita. Conversa nunca aberta conta tudo.
 */
export function unreadByChannel(
  directs: DirectMessage[],
  anonymous: AnonymousMessage[],
  seen: Record<string, string>,
  userId: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const bump = (channel: ChannelId, createdAt: string) => {
    const last = seen[channel];
    if (!last || createdAt > last) counts[channel] = (counts[channel] ?? 0) + 1;
  };
  for (const message of directs) {
    if (message.recipientId === userId) bump(dmChannel(message.senderId), message.createdAt);
  }
  for (const message of anonymous) {
    if (!message.mine) bump("anonimo", message.createdAt);
  }
  return counts;
}

export function totalUnread(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}
