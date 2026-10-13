export const USER_ROLES = ["master", "secretary", "assistant"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Perfil do usuário logado (tabela `profiles`). */
export interface Profile {
  id: string;
  role: UserRole;
  /** `null` apenas para o Master. */
  schoolId: string | null;
  fullName: string;
  lastName: string;
  /** Caminho da foto no bucket `avatars` (para trocar ou remover). */
  avatarPath?: string;
  /** Endereço público da foto. */
  avatarUrl?: string;
  /** Auxiliar com acesso especial: age como secretário, menos na gestão da equipe. */
  elevated?: boolean;
}

export type AuthStatus = "loading" | "signedOut" | "signedIn";
