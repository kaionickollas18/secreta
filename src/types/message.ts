/** Mensagem do mural da escola (tabela `messages`). */
export interface Message {
  id: string;
  /** Ausente quando o autor foi excluído. */
  senderId?: string;
  senderName: string;
  body: string;
  /** ISO 8601 */
  createdAt: string;
}
