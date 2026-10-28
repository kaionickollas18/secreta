import { create } from "zustand";
import type { AnonymousMessage, ChannelId, ChatKey, DirectMessage } from "../types/chat";
import { activeKeyOf, chatSeenKey, keysOfMessage, parseSeen } from "../utils/chat";
import { conversationKey, decryptBytes, decryptText, encryptBytes, encryptText } from "../utils/chatCrypto";
import {
  chatFileType,
  cleanFileName,
  decodeDirectPayload,
  encodeDirectPayload,
  validateChatFile,
  type ChatFileMeta,
} from "../utils/chatFiles";
import {
  downloadChatFile,
  fetchAnonymousMessages,
  fetchChatKeys,
  fetchDirectMessages,
  fetchMyWrappedKey,
  removeAnonymousMessage,
  removeChatFile,
  removeDirectMessage,
  sendAnonymousMessage,
  sendDirectMessage,
  subscribeChat,
  uploadChatFile,
} from "./chatApi";
import { resetKeys, unlockWithPassword, type UnlockResult } from "./chatKeys";
import { readVault, type VaultEntry } from "./chatVault";

interface ChatState {
  /** Chaves públicas da escola (ativas e antigas). */
  keys: ChatKey[];
  directs: DirectMessage[];
  /** Texto aberto de cada mensagem direta; `null` quando não foi possível abrir. */
  plain: Record<string, string | null>;
  /** Nome, tipo e tamanho do anexo de cada mensagem direta que tem um (já abertos). */
  files: Record<string, ChatFileMeta>;
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
  /** `text` pode ser vazio quando há anexo. */
  sendDirect: (userId: string, schoolId: string, peerId: string, text: string, file?: File) => Promise<string | null>;
  /** Baixa e abre o anexo de uma mensagem direta. */
  openFile: (userId: string, messageId: string) => Promise<{ blob: Blob; error: null } | { blob: null; error: string }>;
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

/**
 * Abre as mensagens que ainda não foram abertas. As que não abrem ficam como `null`. Numa
 * mensagem com anexo, o texto aberto traz também nome, tipo e tamanho do arquivo.
 */
async function decryptPending(
  userId: string,
  state: Pick<ChatState, "keys" | "directs" | "plain" | "files">,
): Promise<Pick<ChatState, "plain" | "files">> {
  const plain: Record<string, string | null> = {};
  const files: Record<string, ChatFileMeta> = {};
  await Promise.all(
    state.directs.map(async (message) => {
      const known = state.plain[message.id];
      const knownFile = state.files[message.id];
      if (typeof known === "string" && (!message.attachmentPath || knownFile)) {
        plain[message.id] = known;
        if (knownFile) files[message.id] = knownFile;
        return;
      }
      const ids = keysOfMessage(message, userId);
      const key = keyFor(state.keys, ids.mine, ids.peer);
      try {
        const text = key ? await decryptText(await key, message.iv, message.ciphertext) : null;
        if (text === null || !message.attachmentPath) {
          plain[message.id] = text;
          return;
        }
        const payload = decodeDirectPayload(text);
        plain[message.id] = payload ? payload.text : null;
        if (payload) files[message.id] = payload.file;
      } catch {
        plain[message.id] = null;
      }
    }),
  );
  return { plain, files };
}

const PROTECT_ERROR = "Não foi possível proteger a mensagem. Recarregue a página e tente de novo.";

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
    files: {},
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
      const base = { keys: keys.data, directs: directs.data, plain: get().plain, files: get().files };
      const { plain, files } = await decryptPending(userId, base);
      set({
        status: "ready",
        keys: keys.data,
        directs: directs.data,
        anonymous: anonymous.data,
        plain,
        files,
        hasKey: mine.data !== null,
        lock: vault ? "unlocked" : "locked",
      });
    },

    watch: (userId) => subscribeChat(() => void get().load(userId)),

    unlock: async (userId, password) => adopt(userId, await unlockWithPassword(userId, password)),
    reset: async (userId, password) => adopt(userId, await resetKeys(userId, password)),

    sendDirect: async (userId, schoolId, peerId, text, file) => {
      const mine = vault;
      const peer = activeKeyOf(get().keys, peerId);
      if (!mine) return "Abra suas conversas protegidas com a sua senha antes de enviar.";
      if (!peer) return "Esta pessoa ainda não ativou as conversas protegidas.";
      const keyPromise = keyFor(get().keys, mine.keyId, peer.id);
      if (!keyPromise) return PROTECT_ERROR;
      const fileError = file ? validateChatFile(file) : null;
      if (fileError) return fileError;

      let key: CryptoKey;
      let meta: ChatFileMeta | null = null;
      let sealedFile: ArrayBuffer | null = null;
      try {
        key = await keyPromise;
        if (file) {
          const encrypted = await encryptBytes(key, await file.arrayBuffer());
          sealedFile = encrypted.data;
          meta = { name: cleanFileName(file.name), type: chatFileType(file) ?? file.type, size: file.size, iv: encrypted.iv };
        }
      } catch {
        return PROTECT_ERROR;
      }

      // O arquivo sobe antes; se a mensagem não for gravada, ele é apagado em seguida.
      const path = meta ? `${schoolId}/${userId}/${globalThis.crypto.randomUUID()}` : undefined;
      if (path && sealedFile) {
        const uploadError = await uploadChatFile(path, sealedFile);
        if (uploadError) return uploadError;
      }

      let sealed;
      try {
        sealed = await encryptText(key, meta ? encodeDirectPayload(text, meta) : text);
      } catch {
        if (path) await removeChatFile(path);
        return PROTECT_ERROR;
      }
      const result = await sendDirectMessage({
        recipientId: peerId,
        senderKeyId: mine.keyId,
        recipientKeyId: peer.id,
        ...sealed,
        attachmentPath: path,
      });
      if (result.error !== null) {
        if (path) await removeChatFile(path);
        return result.error;
      }
      const sent = result.data;
      set((s) => ({
        directs: [...s.directs.filter((m) => m.id !== sent.id), sent],
        plain: { ...s.plain, [sent.id]: text },
        files: meta ? { ...s.files, [sent.id]: meta } : s.files,
      }));
      get().markSeen(userId, `dm:${peerId}`);
      return null;
    },

    openFile: async (userId, messageId) => {
      const message = get().directs.find((m) => m.id === messageId);
      const meta = get().files[messageId];
      if (!message?.attachmentPath || !meta) return { blob: null, error: "Este arquivo não está mais disponível." };
      const ids = keysOfMessage(message, userId);
      const key = keyFor(get().keys, ids.mine, ids.peer);
      if (!key) return { blob: null, error: "Este aparelho não consegue abrir este arquivo protegido." };
      const download = await downloadChatFile(message.attachmentPath);
      if (download.error !== null) return { blob: null, error: download.error };
      try {
        const data = await decryptBytes(await key, meta.iv, download.data);
        return { blob: new Blob([data], { type: meta.type }), error: null };
      } catch {
        return { blob: null, error: "Não foi possível abrir este arquivo protegido." };
      }
    },

    removeDirect: async (id) => {
      const path = get().directs.find((m) => m.id === id)?.attachmentPath ?? null;
      const error = await removeDirectMessage(id);
      if (!error) {
        // Sem a mensagem, ninguém mais consegue baixar o arquivo; ele é apagado para não ocupar espaço.
        if (path) await removeChatFile(path);
        set((s) => ({ directs: s.directs.filter((m) => m.id !== id) }));
      }
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
