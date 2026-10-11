import { useMemo } from "react";
import { useAuthStore } from "../store/authStore";
import { useDirectoryStore } from "../store/directoryStore";
import type { UserRole } from "../types/auth";
import { assignableMembers, membersById } from "../utils/assignees";
import { canApproveCompletion, canManageTasks } from "../utils/roles";

/** Papel do usuário logado, o que ele pode fazer no quadro e quem pode ser responsável. */
export function useBoardAccess() {
  const profile = useAuthStore((s) => s.profile);
  const members = useDirectoryStore((s) => s.members);

  return useMemo(() => {
    // Sem perfil (não deveria ocorrer atrás do AuthGate), vale o menor privilégio.
    const role: UserRole = profile?.role ?? "assistant";
    const byId = membersById(members);
    return {
      role,
      schoolId: profile?.schoolId ?? null,
      /** Criar, excluir e definir responsáveis. */
      canManage: canManageTasks(role),
      /** Concluir, reabrir e responder pedidos de conclusão. */
      canApprove: canApproveCompletion(role),
      /** Secretário e auxiliares ativos, na ordem de exibição. */
      people: assignableMembers(members),
      /** Sobrenome do responsável ("" se a pessoa não existe mais). */
      nameOf: (id: string) => byId.get(id)?.lastName ?? "",
      /** Dados completos da pessoa (nome, foto), ou `undefined` se ela não existe mais. */
      personOf: (id: string) => byId.get(id),
    };
  }, [profile, members]);
}
