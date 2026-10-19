import type { SchoolIdentity, SchoolIdentityForm } from "../types/school";
import { createId } from "../utils/id";
import { identityFromRow } from "../utils/schoolIdentity";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/** Dados oficiais da escola (`school_settings`) e a logo dela (bucket `school-logos`). */

const BUCKET = "school-logos";
const GENERIC_ERROR = "Não foi possível salvar. Verifique sua conexão e tente de novo.";
const fail = (error: string = GENERIC_ERROR) => ({ data: null, error });
const COLUMNS = "official_name, inep, address, cep, decree, logo_path";

function logoUrlOf(path: string | undefined): string | undefined {
  if (!supabase || !path) return undefined;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function fetchIdentity(schoolId: string): Promise<ApiResult<SchoolIdentity>> {
  if (!supabase) return fail();
  const { data, error } = await supabase.from("school_settings").select(COLUMNS).eq("school_id", schoolId).maybeSingle();
  if (error) return fail("Não foi possível carregar os dados da escola.");
  const identity = identityFromRow(data as Record<string, unknown> | null);
  return { data: { ...identity, logoUrl: logoUrlOf(identity.logoPath) }, error: null };
}

/** Campos vazios são gravados como nulos. */
export async function saveIdentity(schoolId: string, form: SchoolIdentityForm): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.from("school_settings").upsert(
    {
      school_id: schoolId,
      official_name: form.officialName || null,
      inep: form.inep || null,
      address: form.address || null,
      cep: form.cep || null,
      decree: form.decree || null,
    },
    { onConflict: "school_id" },
  );
  return error ? GENERIC_ERROR : null;
}

/** Envia a logo nova (já reduzida) e aponta a escola para ela; a antiga é apagada. */
export async function uploadLogo(
  schoolId: string,
  image: Blob,
  previousPath?: string,
): Promise<ApiResult<{ path: string; url: string }>> {
  if (!supabase) return fail();
  const path = `${schoolId}/${createId()}.png`;
  const upload = await supabase.storage.from(BUCKET).upload(path, image, { contentType: "image/png" });
  if (upload.error) return fail("Não foi possível enviar a logo.");

  const { error } = await supabase
    .from("school_settings")
    .upsert({ school_id: schoolId, logo_path: path }, { onConflict: "school_id" });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return fail();
  }
  if (previousPath) await supabase.storage.from(BUCKET).remove([previousPath]);
  return { data: { path, url: logoUrlOf(path) ?? "" }, error: null };
}

export async function removeLogo(schoolId: string, path: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.from("school_settings").update({ logo_path: null }).eq("school_id", schoolId);
  if (error) return GENERIC_ERROR;
  await supabase.storage.from(BUCKET).remove([path]);
  return null;
}
