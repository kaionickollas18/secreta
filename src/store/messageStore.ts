import { create } from "zustand";
import type { Message } from "../types/message";
import { fetchMessages, removeMessage, sendMessage, subscribeMessages } from "./messageApi";

const seenKey = (userId: string) => `mural:visto:${userId}`;

/** Momento (ISO) da última visita ao mural neste navegador. */
function readLastSeen(userId: string): string | null {
  try {
    return window.localStorage.getItem(seenKey(userId));
  } catch {
    return null;
  }
}

interface MessageState {
  messages: Message[];
  status: "idle" | "loading" | "ready" | "error";
  /** Última visita ao mural; `null` se nunca visitou. Serve só para o aviso de não lidas. */
  lastSeen: string | null;
  load: (userId: string) => Promise<void>;
  /** Recarrega quando alguém envia ou apaga. Devolve como parar. */
  watch: (userId: string) => () => void;
  /** Devolve a mensagem de erro, ou `null` se deu certo. */
  send: (schoolId: string, body: string) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
  /** Registra que o usuário viu o mural agora. */
  markSeen: (userId: string) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  status: "idle",
  lastSeen: null,

  load: async (userId) => {
    set((s) => ({ status: s.status === "ready" ? "ready" : "loading", lastSeen: readLastSeen(userId) }));
    const result = await fetchMessages();
    if (result.error !== null) return set({ status: "error" });
    set({ status: "ready", messages: result.data });
  },

  watch: (userId) => subscribeMessages(() => void get().load(userId)),

  send: async (schoolId, body) => {
    const result = await sendMessage(schoolId, body);
    if (result.error !== null) return result.error;
    const sent = result.data;
    set((s) => ({ messages: [...s.messages.filter((m) => m.id !== sent.id), sent] }));
    return null;
  },

  remove: async (id) => {
    const error = await removeMessage(id);
    if (!error) set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
    return error;
  },

  markSeen: (userId) => {
    const now = new Date().toISOString();
    try {
      window.localStorage.setItem(seenKey(userId), now);
    } catch {
      // sem armazenamento local: o aviso de não lidas apenas não some entre visitas
    }
    set({ lastSeen: now });
  },
}));
