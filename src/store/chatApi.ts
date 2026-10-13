import type { AnonymousMessage, ChatKey, DirectMessage } from "../types/chat";
import { isPublicJwk, type PublicJwk, type WrappedKey } from "../utils/chatCrypto";
import { MESSAGE_PAGE } from "../utils/messages";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/** Acesso às tabelas das conversas: `chat_keys`, `direct_messages` e `anonymous_messages`. */

const GENERIC_ERROR = "Não foi possível enviar. Verifique sua conexão e tente de novo.";
const fail = (error: string = GENERIC_ERROR) => ({ data: null, error });
const isText = (value: unknown): value is string => typeof value === "string" && value !== "";

/** Quantas mensagens diretas recentes são carregadas (somando todas as conversas). */
export const DIRECT_PAGE = 500;

const KEY_COLUMNS = "id, user_id, public_key, active";
const DIRECT_COLUMNS = "id, sender_id, recipient_id, sender_key_id, recipient_key_id, iv, ciphertext, created_at";

function keyFromRow(row: Record<string, unknown>): ChatKey | null {
  if (!isText(row.id) || !isText(row.user_id) || !isPublicJwk(row.public_key)) return null;
  const { kty, crv, x, y } = row.public_key;
  return { id: row.id, userId: row.user_id, publicKey: { kty, crv, x, y }, active: row.active === true };
}

function directFromRow(row: Record<string, unknown>): DirectMessage | null {
  const { id, sender_id, recipient_id, sender_key_id, recipient_key_id, iv, ciphertext, created_at } = row;
  if (!isText(id) || !isText(sender_id) || !isText(recipient_id)) return null;
  if (!isText(sender_key_id) || !isText(recipient_key_id)) return null;
  if (!isText(iv) || !isText(ciphertext) || !isText(created_at)) return null;
  return {
    id,
    senderId: sender_id,
    recipientId: recipient_id,
    senderKeyId: sender_key_id,
    recipientKeyId: recipient_key_id,
    iv,
    ciphertext,
    createdAt: created_at,
  };
}

/** Chaves públicas de todos da escola, inclusive as antigas (para ler mensagens antigas). */
export async function fetchChatKeys(): Promise<ApiResult<ChatKey[]>> {
  if (!supabase) return fail();
  const { data, error } = await supabase.from("chat_keys").select(KEY_COLUMNS);
  if (error) return fail("Não foi possível carregar as conversas.");
  return { data: (data as Record<string, unknown>[]).flatMap((row) => keyFromRow(row) ?? []), error: null };
}

/** A minha chave privada embaralhada (a ativa). `data: null` sem erro = ainda não tenho chave. */
export async function fetchMyWrappedKey(): Promise<
  { data: ({ id: string } & WrappedKey) | null; error: null } | { data: null; error: string }
> {
  if (!supabase) return fail();
  const { data, error } = await supabase.rpc("my_chat_key");
  if (error) return fail("Não foi possível carregar as conversas.");
  const row: unknown = Array.isArray(data) ? data[0] : data;
  if (typeof row !== "object" || row === null) return { data: null, error: null };
  const { id, wrapped_private_key: wrapped, salt, iv } = row as Record<string, unknown>;
  if (!isText(id) || !isText(wrapped) || !isText(salt) || !isText(iv)) return { data: null, error: null };
  return { data: { id, wrapped, salt, iv }, error: null };
}

/** Grava um par de chaves novo como o ativo (desativando o anterior). Devolve o id dele. */
export async function createChatKey(userId: string, publicKey: PublicJwk, wrapped: WrappedKey): Promise<ApiResult<string>> {
  if (!supabase) return fail();
  const retire = await supabase.from("chat_keys").update({ active: false }).eq("user_id", userId).eq("active", true);
  if (retire.error) return fail();
  const { data, error } = await supabase
    .from("chat_keys")
    .insert({ public_key: publicKey, wrapped_private_key: wrapped.wrapped, salt: wrapped.salt, iv: wrapped.iv })
    .select("id")
    .single();
  if (error || !isText(data?.id)) return fail(error?.code === "P0001" ? error.message : GENERIC_ERROR);
  return { data: data.id, error: null };
}

/** Troca só o embaralhamento da privada (quando a pessoa muda a senha). */
export async function rewrapChatKey(keyId: string, wrapped: WrappedKey): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase
    .from("chat_keys")
    .update({ wrapped_private_key: wrapped.wrapped, salt: wrapped.salt, iv: wrapped.iv })
    .eq("id", keyId);
  return error ? GENERIC_ERROR : null;
}

/** Confere a senha da conta de quem está logado. */
export async function verifyPassword(password: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return false;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

/** As mensagens diretas mais recentes de que participo, da mais antiga para a mais nova. */
export async function fetchDirectMessages(): Promise<ApiResult<DirectMessage[]>> {
  if (!supabase) return fail();
  const { data, error } = await supabase
    .from("direct_messages")
    .select(DIRECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(DIRECT_PAGE);
  if (error) return fail("Não foi possível carregar as conversas.");
  return {
    data: (data as Record<string, unknown>[]).flatMap((row) => directFromRow(row) ?? []).reverse(),
    error: null,
  };
}

/** Envia o texto já embaralhado. Remetente, escola e horário são preenchidos pelo banco. */
export async function sendDirectMessage(input: {
  recipientId: string;
  senderKeyId: string;
  recipientKeyId: string;
  iv: string;
  ciphertext: string;
}): Promise<ApiResult<DirectMessage>> {
  if (!supabase) return fail();
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({
      recipient_id: input.recipientId,
      sender_key_id: input.senderKeyId,
      recipient_key_id: input.recipientKeyId,
      iv: input.iv,
      ciphertext: input.ciphertext,
    })
    .select(DIRECT_COLUMNS)
    .single();
  if (error) return fail(error.code === "P0001" ? error.message : GENERIC_ERROR);
  const message = directFromRow(data as Record<string, unknown>);
  return message ? { data: message, error: null } : fail();
}

export async function removeDirectMessage(id: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.from("direct_messages").delete().eq("id", id);
  return error ? "Não foi possível apagar a mensagem." : null;
}

/** As mensagens recentes do canal anônimo, com a marca das que eu escrevi. */
export async function fetchAnonymousMessages(): Promise<ApiResult<AnonymousMessage[]>> {
  if (!supabase) return fail();
  const [messages, mine] = await Promise.all([
    supabase
      .from("anonymous_messages")
      .select("id, body, created_at")
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE),
    // A RLS só devolve as linhas de autoria de quem pergunta.
    supabase.from("anonymous_message_authors").select("message_id"),
  ]);
  if (messages.error || mine.error) return fail("Não foi possível carregar as mensagens.");
  const own = new Set((mine.data as { message_id: unknown }[]).map((row) => row.message_id));
  return {
    data: (messages.data as Record<string, unknown>[])
      .flatMap(({ id, body, created_at: createdAt }) =>
        isText(id) && isText(body) && isText(createdAt) ? [{ id, body, createdAt, mine: own.has(id) }] : [],
      )
      .reverse(),
    error: null,
  };
}

export async function sendAnonymousMessage(schoolId: string, body: string): Promise<ApiResult<AnonymousMessage>> {
  if (!supabase) return fail();
  const { data, error } = await supabase
    .from("anonymous_messages")
    .insert({ school_id: schoolId, body })
    .select("id, body, created_at")
    .single();
  if (error || !isText(data?.id) || !isText(data.created_at)) return fail();
  return { data: { id: data.id, body, createdAt: data.created_at, mine: true }, error: null };
}

export async function removeAnonymousMessage(id: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.from("anonymous_messages").delete().eq("id", id);
  return error ? "Não foi possível apagar a mensagem." : null;
}

/** Avisa quando chega ou some uma mensagem direta ou anônima. Devolve como parar. */
export function subscribeChat(onChange: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel("chat-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "anonymous_messages" }, onChange)
    .subscribe();
  return () => void client.removeChannel(channel);
}
