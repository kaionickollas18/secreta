import { createId } from "../utils/id";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/** Perfil próprio: foto (bucket `avatars`), sobrenome (`profiles`) e senha (Supabase Auth). */

const BUCKET = "avatars";
const GENERIC_ERROR = "Não foi possível salvar. Verifique sua conexão e tente de novo.";

/** Endereço público de uma foto a partir do caminho guardado no perfil. */
export function avatarUrlOf(path: string | null | undefined): string | undefined {
  if (!supabase || !path) return undefined;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function updateLastName(userId: string, lastName: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.from("profiles").update({ last_name: lastName }).eq("id", userId);
  return error ? GENERIC_ERROR : null;
}

/** Apelido e data de nascimento da própria pessoa (`null` apaga). */
export async function updatePersonalDetails(
  userId: string,
  details: { nickname: string | null; birthDate: string | null },
): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase
    .from("profiles")
    .update({ nickname: details.nickname, birth_date: details.birthDate })
    .eq("id", userId);
  return error ? GENERIC_ERROR : null;
}

/**
 * Envia a foto nova (já reduzida) e aponta o perfil para ela. O nome do arquivo é aleatório:
 * o endereço muda a cada troca, então nenhum navegador fica mostrando a foto antiga.
 */
export async function uploadAvatar(
  userId: string,
  image: Blob,
  previousPath?: string,
): Promise<ApiResult<{ path: string; url: string }>> {
  if (!supabase) return { data: null, error: GENERIC_ERROR };
  const path = `${userId}/${createId()}.jpg`;
  const upload = await supabase.storage.from(BUCKET).upload(path, image, { contentType: "image/jpeg" });
  if (upload.error) return { data: null, error: "Não foi possível enviar a foto." };

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { data: null, error: GENERIC_ERROR };
  }
  // A foto antiga deixa de ser usada; se a limpeza falhar, só sobra um arquivo órfão.
  if (previousPath) await supabase.storage.from(BUCKET).remove([previousPath]);
  return { data: { path, url: avatarUrlOf(path) ?? "" }, error: null };
}

export async function removeAvatar(userId: string, path: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
  if (error) return GENERIC_ERROR;
  await supabase.storage.from(BUCKET).remove([path]);
  return null;
}

/** Troca a senha depois de conferir a atual, para ninguém trocar a senha de uma sessão esquecida aberta. */
export async function changePassword(current: string, next: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return "Sessão expirada. Entre de novo e tente outra vez.";

  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) return "A senha atual está incorreta.";

  const { error } = await supabase.auth.updateUser({ password: next });
  if (!error) return null;
  return error.message.toLowerCase().includes("different")
    ? "A nova senha precisa ser diferente da atual."
    : "Não foi possível trocar a senha. Tente uma senha mais forte.";
}
