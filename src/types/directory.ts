import type { ManagedRole } from "../utils/roles";
import type { UserRole } from "./auth";

export interface School {
  id: string;
  name: string;
}

/** Pessoa cadastrada (tabela `profiles`). */
export interface Member {
  id: string;
  role: UserRole;
  schoolId: string | null;
  fullName: string;
  lastName: string;
  email: string;
  active: boolean;
  /** Endereço público da foto de perfil, se a pessoa enviou uma. */
  avatarUrl?: string;
  /** Assistente com acesso especial, concedido pelo secretário. */
  elevated?: boolean;
  /** Como a pessoa prefere ser chamada. Ela mesma define, no Perfil. */
  nickname?: string;
  /** Data de nascimento (YYYY-MM-DD). Ela mesma informa, no Perfil. */
  birthDate?: string;
}

/** Valores crus do formulário de cadastro/edição. */
export interface MemberFormValues {
  schoolName: string;
  fullName: string;
  email: string;
  password: string;
  active: boolean;
  /** Equipe da escola: assistente ou professor. */
  role: ManagedRole;
  /** Campos de perfil que o secretário edita (só na edição de alguém da equipe). */
  lastName: string;
  nickname: string;
  birthDate: string;
  removePhoto: boolean;
}

export type MemberFormErrors = Partial<Record<keyof MemberFormValues, string>>;
