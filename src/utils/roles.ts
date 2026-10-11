import type { UserRole } from "../types/auth";

export const ROLE_LABELS: Record<UserRole, string> = {
  master: "Master",
  secretary: "Secretário",
  assistant: "Auxiliar Administrativo",
};

/** Perfis que usam o quadro e o dashboard (o Master só gerencia escolas). */
export const SCHOOL_ROLES: readonly UserRole[] = ["secretary", "assistant"];

export function isSchoolRole(role: UserRole): boolean {
  return SCHOOL_ROLES.includes(role);
}

/** Somente o Secretário cria e exclui tarefas e define responsáveis. */
export function canManageTasks(role: UserRole): boolean {
  return role === "secretary";
}

/** Somente o Secretário move para Concluído e responde pedidos de conclusão. */
export function canApproveCompletion(role: UserRole): boolean {
  return role === "secretary";
}

/** Somente o Secretário configura a base de dados do dashboard (link ou arquivos). */
export function canConfigureDashboard(role: UserRole): boolean {
  return role === "secretary";
}

/** Somente o Secretário cria, edita, exclui e marca lembretes como feitos. */
export function canManageReminders(role: UserRole): boolean {
  return role === "secretary";
}

/** O Secretário modera o mural: pode apagar mensagens de qualquer pessoa da escola. */
export function canModerateMessages(role: UserRole): boolean {
  return role === "secretary";
}

export function canManageSchools(role: UserRole): boolean {
  return role === "master";
}

export function canManageAssistants(role: UserRole): boolean {
  return role === "secretary";
}
