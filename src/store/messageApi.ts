import type { Message } from "../types/message";
import { MESSAGE_PAGE } from "../utils/messages";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/** Acesso à tabela `messages` (mural da escola). */

const GENERIC_ERROR = "Não foi possível enviar. Verifique sua conexão e tente de novo.";
const fail = (error: string = GENERIC_ERROR) => ({ data: null, error });

const COLUMNS = "id, sender_id, sender_name, body, created_at";

interface MessageRow {
  id: string;
  sender_id: string | null;
  sender_name: string;
  body: string;
  created_at: string;
}

function fromRow(row: MessageRow): Message {
  return {
    id: row.id,
    senderId: row.sender_id ?? undefined,
    senderName: row.sender_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

/** As mensagens mais recentes, em ordem cronológica (a mais nova por último). */
export async function fetchMessages(): Promise<ApiResult<Message[]>> {
  if (!supabase) return fail();
  const { data, error } = await supabase
    .from("messages")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE);
  if (error) return fail("Não foi possível carregar as mensagens.");
  return { data: (data as MessageRow[]).map(fromRow).reverse(), error: null };
}

/** Autor, nome e horário são preenchidos pelo banco a partir da sessão. */
export async function sendMessage(schoolId: string, body: string): Promise<ApiResult<Message>> {
  if (!supabase) return fail();
  const { data, error } = await supabase
    .from("messages")
    .insert({ school_id: schoolId, body, sender_name: "" })
    .select(COLUMNS)
    .single();
  if (error) return fail();
  return { data: fromRow(data as MessageRow), error: null };
}

export async function removeMessage(id: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.from("messages").delete().eq("id", id);
  return error ? "Não foi possível apagar a mensagem." : null;
}

/** Avisa quando chega ou some uma mensagem da escola. Devolve como parar. */
export function subscribeMessages(onChange: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel("messages-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, onChange)
    .subscribe();
  return () => void client.removeChannel(channel);
}
