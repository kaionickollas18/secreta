import {
  generateKeyPair,
  importPrivateKey,
  unwrapPrivateKey,
  wrapPrivateKey,
} from "../utils/chatCrypto";
import { createChatKey, fetchMyWrappedKey, rewrapChatKey, verifyPassword } from "./chatApi";
import { writeVault, type VaultEntry } from "./chatVault";

/**
 * Abrir, criar e trocar a chave das conversas protegidas. Fica separado do `chatStore`
 * porque o login e a troca de senha (no `authStore`) também passam por aqui.
 */

export type UnlockResult =
  | { ok: true; entry: VaultEntry }
  /** `wrong-password`: a senha não abre a chave guardada (ou não é a senha da conta). */
  | { ok: false; reason: "wrong-password" | "failed"; error: string };

const WRONG_PASSWORD =
  "Essa senha não abre suas conversas. Se a sua senha foi redefinida por outra pessoa, use “Recomeçar”.";
const FAILED = "Não foi possível abrir as conversas. Verifique sua conexão e tente de novo.";

/** Cria um par de chaves novo, protegido por `password`, e o guarda neste aparelho. */
async function createKeys(userId: string, password: string): Promise<UnlockResult> {
  const pair = await generateKeyPair();
  const wrapped = await wrapPrivateKey(pair.privateBytes, password);
  const created = await createChatKey(userId, pair.publicKey, wrapped);
  if (created.error !== null) return { ok: false, reason: "failed", error: created.error };
  const entry = { userId, keyId: created.data, privateKey: await importPrivateKey(pair.privateBytes) };
  await writeVault(entry);
  return { ok: true, entry };
}

/**
 * Abre as conversas neste aparelho com a senha da conta. Quem ainda não tem chave ganha uma.
 * `verified`: a senha acabou de ser conferida (no login); senão é conferida antes de criar a
 * chave, para ela nunca ficar presa a uma senha digitada errado.
 */
export async function unlockWithPassword(userId: string, password: string, verified = false): Promise<UnlockResult> {
  try {
    const mine = await fetchMyWrappedKey();
    if (mine.error !== null) return { ok: false, reason: "failed", error: FAILED };
    if (mine.data === null) {
      if (!verified && !(await verifyPassword(password))) {
        return { ok: false, reason: "wrong-password", error: "Senha incorreta." };
      }
      return await createKeys(userId, password);
    }
    let privateBytes;
    try {
      privateBytes = await unwrapPrivateKey(mine.data, password);
    } catch {
      return { ok: false, reason: "wrong-password", error: WRONG_PASSWORD };
    }
    const entry = { userId, keyId: mine.data.id, privateKey: await importPrivateKey(privateBytes) };
    await writeVault(entry);
    return { ok: true, entry };
  } catch {
    return { ok: false, reason: "failed", error: FAILED };
  }
}

/**
 * Recomeça com uma chave nova (para quem teve a senha redefinida e não abre mais a antiga).
 * As mensagens anteriores deixam de abrir para esta pessoa; o colega continua lendo as dele.
 */
export async function resetKeys(userId: string, password: string): Promise<UnlockResult> {
  try {
    if (!(await verifyPassword(password))) return { ok: false, reason: "wrong-password", error: "Senha incorreta." };
    return await createKeys(userId, password);
  } catch {
    return { ok: false, reason: "failed", error: FAILED };
  }
}

/**
 * Depois de trocar a senha: embaralha a mesma chave com a senha nova, para as conversas
 * continuarem abrindo em outros aparelhos. Devolve `false` se não conseguiu.
 */
export async function rewrapForNewPassword(current: string, next: string): Promise<boolean> {
  try {
    const mine = await fetchMyWrappedKey();
    if (mine.error !== null) return false;
    if (mine.data === null) return true;
    const privateBytes = await unwrapPrivateKey(mine.data, current);
    return (await rewrapChatKey(mine.data.id, await wrapPrivateKey(privateBytes, next))) === null;
  } catch {
    return false;
  }
}
