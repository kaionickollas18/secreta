import { create } from "zustand";
import type { AnonymousMessage, ChannelId, ChatKey, DirectMessage } from "../types/chat";
import { activeKeyOf, chatSeenKey, keysOfMessage, parseSeen } from "../utils/chat";
import { conversationKey, decryptText, encryptText } from "../utils/chatCrypto";
import {
  fetchAnonymousMessages,
  fetchChatKeys,
  fetchDirectMessages,
  fetchMyWrappedKey,
  removeAnonymousMessage,
  removeDirectMessage,
  sendAnonymousMessage,
  sendDirectMessage,
  subscribeChat,
} from "./chatApi";
import { resetKeys, unlockWithPassword, type UnlockResult } from "./chatKeys";
import { readVault, type VaultEntry } from "./chatVault";

interface ChatState {
  /** Chaves públicas da escola (ativas e antigas). */
  keys: ChatKey[];
  directs: DirectMessage[];
  /** Texto aberto de cada mensagem direta; `null` quando não foi possível abrir. */
  plain: Record<string, string | null>;
  anonymous: AnonymousMessage[];
  status: "idle" | "loading" | "ready" | "error";
  /** `locked`: este aparelho ainda não tem a chave; a pessoa precisa digitar a senha. */
  lock: "checking" | "locked" | "unlocked";
  /** Já existe uma chave minha no banco (senão, a senha vai criar a primeira). */
  hasKey: boolean;
  /** Última visita a cada conversa, por navegador (só para o aviso de não lidas). */
  seen: Record<string, string>;
  load: (userId: string) => Promise<void>;
  /** Recarrega quando chega ou some uma mensagem. Devolve como parar. */
  watch: (userId: string) => () => void;
  /** Cada ação devolve a mensagem de erro, ou `null` se deu certo. */
  unlock: (userId: string, password: string) => Promise<string | null>;
  reset: (userId: string, password: string) => Promise<string | null>;
  sendDirect: (userId: string, peerId: string, text: string) => Promise<string | null>;
  removeDirect: (id: string) => Promise<string | null>;
  sendAnonymous: (schoolId: string, body: string) => Promise<string | null>;
  removeAnonymous: (id: string) => Promise<string | null>;
  markSeen: (userId: string, channel: ChannelId) => void;
}

// A chave privada e as chaves de conversa ficam fora do estado: não são dados de tela.
let vault: VaultEntry | null = null;
const conversationKeys = new Map<string, Promise<CryptoKey>>();

function keyFor(keys: ChatKey[], mineId: string, peerId: string): Promise<CryptoKey> | null {
  if (!vault || vault.keyId !== mineId) return null;
  const peer = keys.find((k) => k.id === peerId);
  if (!peer) return null;
  const cacheId = `${mineId}|${peerId}`;
  let key = conversationKeys.get(cacheId);
  if (!key) {
    key = conversationKey(vault.privateKey, peer.publicKey);
    conversationKeys.set(cacheId, key);
  }
  return key;
}

/** Abre as mensagens que ainda não foram abertas. As que não abrem ficam como `null`. */
async function decryptPending(
  userId: string,
  state: Pick<ChatState, "keys" | "directs" | "plain">,
): Promise<Record<string, string | null>> {
  const plain: Record<string, string | null> = {};
  await Promise.all(
    state.directs.map(async (message) => {
      const known = state.plain[message.id];
      if (typeof known === "string") {
        plain[message.id] = known;
        return;
      }
      const ids = keysOfMessage(message, userId);
      const key = keyFor(state.keys, ids.mine, ids.peer);
      try {
        plain[message.id] = key ? await decryptText(await key, message.iv, message.ciphertext) : null;
      } catch {
        plain[message.id] = null;
      }
    }),
  );
  return plain;
}

function readSeen(userId: string): Record<string, string> {
  try {
    return parseSeen(window.localStorage.getItem(chatSeenKey(userId)));
  } catch {
    return {};
  }
}

export const useChatStore = create<ChatState>((set, get) => {
  /** Guarda a chave aberta e reabre as mensagens com ela. */
  async function adopt(userId: string, result: UnlockResult): Promise<string | null> {
    if (!result.ok) return result.error;
    vault = result.entry;
    conversationKeys.clear();
    // Quem acabou de ganhar chave ainda não aparece na lista carregada: busca de novo.
    await get().load(userId);
    return null;
  }

  return {
    keys: [],
    directs: [],
    plain: {},
    anonymous: [],
    status: "idle",
    lock: "checking",
    hasKey: false,
    seen: {},

    load: async (userId) => {
      set((s) => ({ status: s.status === "ready" ? "ready" : "loading", seen: readSeen(userId) }));
      const [keys, directs, anonymous, mine, entry] = await Promise.all([
        fetchChatKeys(),
        fetchDirectMessages(),
        fetchAnonymousMessages(),
        fetchMyWrappedKey(),
        readVault(userId),
      ]);
      if (keys.error !== null || directs.error !== null || anonymous.error !== null || mine.error !== null) {
        return set({ status: "error" });
      }
      // A chave do aparelho só vale se for a que está ativa no banco.
      const usable = entry && mine.data && entry.keyId === mine.data.id ? entry : null;
      if (usable?.keyId !== vault?.keyId) conversationKeys.clear();
      vault = usable;
      const base = { keys: keys.data, directs: directs.data, plain: get().plain };
      const plain = await decryptPending(userId, base);
      set({
        status: "ready",
        keys: keys.data,
        directs: directs.data,
        anonymous: anonymous.data,
        plain,
        hasKey: mine.data !== null,
        lock: vault ? "unlocked" : "locked",
      });
    },

    watch: (userId) => subscribeChat(() => void get().load(userId)),

    unlock: async (userId, password) => adopt(userId, await unlockWithPassword(userId, password)),
    reset: async (userId, password) => adopt(userId, await resetKeys(userId, password)),

    sendDirect: async (userId, peerId, text) => {
      const mine = vault;
      const peer = activeKeyOf(get().keys, peerId);
      if (!mine) return "Abra suas conversas protegidas com a sua senha antes de enviar.";
      if (!peer) return "Esta pessoa ainda não ativou as conversas protegidas.";
      const key = keyFor(get().keys, mine.keyId, peer.id);
      if (!key) return "Não foi possível proteger a mensagem. Recarregue a página e tente de novo.";
      let sealed;
      try {
        sealed = await encryptText(await key, text);
      } catch {
        return "Não foi possível proteger a mensagem. Recarregue a página e tente de novo.";
      }
      const result = await sendDirectMessage({
        recipientId: peerId,
        senderKeyId: mine.keyId,
        recipientKeyId: peer.id,
        ...sealed,
      });
      if (result.error !== null) return result.error;
      const sent = result.data;
      set((s) => ({
        directs: [...s.directs.filter((m) => m.id !== sent.id), sent],
        plain: { ...s.plain, [sent.id]: text },
      }));
      get().markSeen(userId, `dm:${peerId}`);
      return null;
    },

    removeDirect: async (id) => {
      const error = await removeDirectMessage(id);
      if (!error) set((s) => ({ directs: s.directs.filter((m) => m.id !== id) }));
      return error;
    },

    sendAnonymous: async (schoolId, body) => {
      const result = await sendAnonymousMessage(schoolId, body);
      if (result.error !== null) return result.error;
      const sent = result.data;
      set((s) => ({ anonymous: [...s.anonymous.filter((m) => m.id !== sent.id), sent] }));
      return null;
    },

    removeAnonymous: async (id) => {
      const error = await removeAnonymousMessage(id);
      if (!error) set((s) => ({ anonymous: s.anonymous.filter((m) => m.id !== id) }));
      return error;
    },

    markSeen: (userId, channel) => {
      const seen = { ...get().seen, [channel]: new Date().toISOString() };
      try {
        window.localStorage.setItem(chatSeenKey(userId), JSON.stringify(seen));
      } catch {
        // sem armazenamento local: o aviso de não lidas apenas não some entre visitas
      }
      set({ seen });
    },
  };
});
