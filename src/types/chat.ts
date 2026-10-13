import type { PublicJwk } from "../utils/chatCrypto";

/** Chave pública de alguém da escola (tabela `chat_keys`). */
export interface ChatKey {
  id: string;
  userId: string;
  publicKey: PublicJwk;
  /** A chave em uso. As inativas servem para ler mensagens antigas. */
  active: boolean;
}

/** Mensagem direta como vem do banco: só o texto embaralhado. */
export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  senderKeyId: string;
  recipientKeyId: string;
  iv: string;
  ciphertext: string;
  /** ISO 8601 */
  createdAt: string;
}

/** Mensagem do canal anônimo. Não tem autor; `mine` diz só se fui eu que escrevi. */
export interface AnonymousMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

/** Conversa aberta na tela: o mural de todos, o canal anônimo ou um colega (`dm:<id>`). */
export type ChannelId = "geral" | "anonimo" | `dm:${string}`;

/** Uma mensagem pronta para a tela, de qualquer canal. */
export interface ThreadMessage {
  id: string;
  mine: boolean;
  /** Nome exibido sobre a mensagem. */
  author: string;
  /** `null`: não foi possível abrir (chave antiga ou conversas ainda trancadas). */
  body: string | null;
  createdAt: string;
  canDelete: boolean;
  /** Semente da cor do nome (id ou nome do autor). */
  colorSeed?: string;
}
