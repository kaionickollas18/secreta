import type { DeliveryInput, DocumentInput, OfficialDocument } from "../types/officialDocument";
import { documentFromRow } from "../utils/officialDocuments";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/** Acesso à tabela `official_documents` (memorandos e ofícios). */

const GENERIC_ERROR = "Não foi possível salvar. Verifique sua conexão e tente de novo.";
const fail = (error: string = GENERIC_ERROR) => ({ data: null, error });
const COLUMNS = "id, kind, number, issued_on, recipient, subject, summary, delivered_on, received_by";

type Row = Record<string, unknown>;

async function single(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<ApiResult<OfficialDocument>> {
  const { data, error } = await query;
  if (error || !data) return fail();
  const document = documentFromRow(data as Row);
  return document ? { data: document, error: null } : fail();
}

export async function fetchDocuments(): Promise<ApiResult<OfficialDocument[]>> {
  if (!supabase) return fail();
  const { data, error } = await supabase.from("official_documents").select(COLUMNS);
  if (error) return fail("Não foi possível carregar os documentos.");
  return { data: (data as Row[]).flatMap((row) => documentFromRow(row) ?? []), error: null };
}

/** Cria (sem `id`) ou atualiza os dados do documento. Não mexe na entrega. */
export async function saveDocument(
  schoolId: string,
  input: DocumentInput,
  id?: string,
): Promise<ApiResult<OfficialDocument>> {
  if (!supabase) return fail();
  const row = {
    kind: input.kind,
    number: input.number,
    issued_on: input.issuedOn,
    recipient: input.recipient,
    subject: input.subject,
    summary: input.summary ?? null,
  };
  const table = supabase.from("official_documents");
  const query = id ? table.update(row).eq("id", id) : table.insert({ ...row, school_id: schoolId });
  return single(query.select(COLUMNS).single());
}

/** Marca a entrega (com o resumo) ou, com `null`, desfaz a marcação. */
export async function setDelivery(id: string, delivery: DeliveryInput | null): Promise<ApiResult<OfficialDocument>> {
  if (!supabase) return fail();
  const row = delivery
    ? { summary: delivery.summary, delivered_on: delivery.deliveredOn, received_by: delivery.receivedBy ?? null }
    : { delivered_on: null, received_by: null };
  return single(supabase.from("official_documents").update(row).eq("id", id).select(COLUMNS).single());
}

export async function removeDocument(id: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  // Pede a linha de volta: se a RLS barrar a exclusão, nada volta e isso vira erro.
  const { data, error } = await supabase.from("official_documents").delete().eq("id", id).select("id");
  if (error) return GENERIC_ERROR;
  return data.length === 0 ? "Só o secretário pode excluir documentos." : null;
}
