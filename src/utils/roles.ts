import type { UserRole } from "../types/auth";

export const ROLE_LABELS: Record<UserRole, string> = {
  master: "Master",
  secretary: "Secretário",
  assistant: "Auxiliar Administrativo",
};

/** Nome do acesso especial, como aparece na tela. */
export const ELEVATED_LABEL = "Acesso de secretário";

/**
 * Papel que vale para o trabalho do dia a dia. O auxiliar com acesso especial age como
 * secretário (tarefas, lembretes, dashboard, mural). A gestão da equipe é a exceção: ela
 * olha o papel real (`canManageAssistants(profile.role)`), então continua só do secretário.
 */
export function effectiveRole(profile: { role: UserRole; elevated?: boolean }): UserRole {
  return profile.role === "assistant" && profile.elevated ? "secretary" : profile.role;
}

/** "Auxiliar Administrativo · Acesso de secretário", ou só o nome do papel. */
export function roleLabel(profile: { role: UserRole; elevated?: boolean }): string {
  const label = ROLE_LABELS[profile.role];
  return profile.role === "assistant" && profile.elevated ? `${label} · ${ELEVATED_LABEL}` : label;
}

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

/** Somente o Secretário cadastra, edita e exclui feriados e recessos da escola. */
export function canManageHolidays(role: UserRole): boolean {
  return role === "secretary";
}

/** Qualquer pessoa da escola cria e edita notas; excluir, só quem escreveu ou o Secretário. */
export function canDeleteNote(role: UserRole, isAuthor: boolean): boolean {
  return isAuthor || role === "secretary";
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
