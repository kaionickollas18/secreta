/**
 * Cofre do aparelho: guarda a chave privada das conversas no navegador (IndexedDB), já
 * importada como **não exportável** — dá para usá-la, mas não para copiá-la. É o que permite
 * abrir as conversas sem digitar a senha a cada página. É apagada ao sair da conta.
 */

export interface VaultEntry {
  userId: string;
  /** Id da chave no banco (`chat_keys.id`) a que esta privada corresponde. */
  keyId: string;
  privateKey: CryptoKey;
}

const DB_NAME = "secreta-conversas";
const STORE = "chaves";

/** Sem IndexedDB (navegação privada antiga, testes): vale só enquanto a página está aberta. */
const memory = new Map<string, VaultEntry>();

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "userId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function isEntry(value: unknown): value is VaultEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.userId === "string" && typeof entry.keyId === "string" && entry.privateKey instanceof CryptoKey;
}

/** Roda uma operação no cofre; qualquer falha do navegador vira `null`. */
async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  try {
    return await new Promise<T | null>((resolve) => {
      try {
        const request = work(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } finally {
    db.close();
  }
}

export async function readVault(userId: string): Promise<VaultEntry | null> {
  const held = memory.get(userId);
  if (held) return held;
  const stored = await run<unknown>("readonly", (store) => store.get(userId));
  if (!isEntry(stored)) return null;
  memory.set(userId, stored);
  return stored;
}

export async function writeVault(entry: VaultEntry): Promise<void> {
  memory.set(entry.userId, entry);
  await run("readwrite", (store) => store.put(entry));
}

/** Apaga as chaves deste aparelho (ao sair da conta). */
export async function clearVault(): Promise<void> {
  memory.clear();
  await run("readwrite", (store) => store.clear());
}
