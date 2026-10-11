import type { Message } from "../types/message";
import { todayISO } from "./date";
import { sanitizeText } from "./validation";

export const MESSAGE_MAX = 2000;
/** Quantas mensagens recentes o mural carrega. */
export const MESSAGE_PAGE = 100;

/** Texto pronto para enviar, ou a mensagem de erro. */
export function validateMessage(body: string): { valid: true; value: string } | { valid: false; error: string } {
  const value = sanitizeText(body);
  if (value.length === 0) return { valid: false, error: "Escreva uma mensagem." };
  if (value.length > MESSAGE_MAX)
    return { valid: false, error: `Use no máximo ${MESSAGE_MAX} caracteres.` };
  return { valid: true, value };
}

/** Rótulo do dia de um grupo de mensagens: "Hoje", "Ontem" ou a data. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const day = todayISO(date);
  if (day === todayISO(now)) return "Hoje";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day === todayISO(yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Agrupa as mensagens (já em ordem cronológica) por dia local. */
export function groupByDay(messages: Message[], now: Date = new Date()): { label: string; messages: Message[] }[] {
  const groups: { label: string; messages: Message[] }[] = [];
  for (const message of messages) {
    const label = dayLabel(message.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.messages.push(message);
    else groups.push({ label, messages: [message] });
  }
  return groups;
}

/** Mensagens de outras pessoas mais novas que a última visita ao mural. */
export function countUnread(messages: Message[], lastSeen: string | null, userId: string): number {
  return messages.filter((m) => m.senderId !== userId && (!lastSeen || m.createdAt > lastSeen)).length;
}
