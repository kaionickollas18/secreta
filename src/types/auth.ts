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
}

export type AuthStatus = "loading" | "signedOut" | "signedIn";
