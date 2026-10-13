import type { Profile } from "../types/auth";
import { isUserRole } from "./guards";

/** Chave do perfil guardado no navegador para a moldura abrir sem espera. */
export const PROFILE_CACHE_KEY = "secreta:perfil";

/**
 * Lê o perfil guardado. É dado externo (qualquer um pode editar o armazenamento do
 * navegador), então é validado; e serve só para desenhar a tela mais cedo. Quem decide
 * o que cada pessoa pode fazer continua sendo o banco.
 */
export function parseCachedProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const v = value as Record<string, unknown>;
    if (
      typeof v.id !== "string" ||
      v.id.length === 0 ||
      !isUserRole(v.role) ||
      typeof v.fullName !== "string" ||
      typeof v.lastName !== "string" ||
      !(v.schoolId === null || typeof v.schoolId === "string")
    ) {
      return null;
    }
    // O Master não tem escola; os demais precisam de uma.
    if ((v.role === "master") !== (v.schoolId === null)) return null;
    // Foto: opcional; o endereço só vale se for https (nunca `javascript:` ou parecido).
    const hasPhoto =
      typeof v.avatarPath === "string" &&
      typeof v.avatarUrl === "string" &&
      v.avatarUrl.startsWith("https://");
    return {
      id: v.id,
      role: v.role,
      schoolId: v.schoolId,
      fullName: v.fullName,
      lastName: v.lastName,
      ...(hasPhoto ? { avatarPath: v.avatarPath as string, avatarUrl: v.avatarUrl as string } : {}),
      // Só vale para auxiliar. Serve para a tela mostrar os botões certos; o banco decide.
      ...(v.role === "assistant" && v.elevated === true ? { elevated: true } : {}),
    };
  } catch {
    return null;
  }
}
