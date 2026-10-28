import { FunctionsHttpError } from "@supabase/supabase-js";
import { create } from "zustand";
import type { Member, School } from "../types/directory";
import { isValidISODate } from "../utils/date";
import { isUserRole } from "../utils/guards";
import type { PersonalDetails } from "../utils/profileForm";
import type { ManagedRole } from "../utils/roles";
import { avatarUrlOf, updatePersonalDetails } from "./profileApi";
import { supabase } from "./supabaseClient";

const GENERIC_ERROR = "Não foi possível concluir a operação. Tente novamente.";

interface NewMember {
  fullName: string;
  email: string;
  password: string;
}

interface MemberPatch {
  fullName?: string;
  /** Como aparece nas tarefas e nas conversas. */
  lastName?: string;
  /** Vazio apaga. */
  nickname?: string;
  /** AAAA-MM-DD; vazio apaga. */
  birthDate?: string;
  email?: string;
  /** Assistente ou professor (só o secretário muda). */
  role?: ManagedRole;
  /** Apaga a foto de perfil da pessoa. */
  removePhoto?: boolean;
  /** Vazio ou ausente mantém a senha atual. */
  password?: string;
  active?: boolean;
  /** Acesso especial do assistente (só o secretário altera). */
  elevated?: boolean;
}

interface DirectoryState {
  schools: School[];
  members: Member[];
  status: "idle" | "loading" | "ready" | "error";
  /** Cada ação devolve a mensagem de erro (ou `null` se deu certo). */
  load: () => Promise<void>;
  createSchool: (schoolName: string, secretary: NewMember) => Promise<string | null>;
  renameSchool: (id: string, name: string) => Promise<string | null>;
  deleteSchool: (id: string) => Promise<string | null>;
  /** O secretário cadastra um assistente ou um professor da própria escola. */
  createMember: (input: NewMember & { role: ManagedRole }) => Promise<string | null>;
  updateMember: (id: string, patch: MemberPatch) => Promise<string | null>;
  deleteMember: (id: string) => Promise<string | null>;
  /** A própria pessoa grava o apelido e o nascimento dela. */
  savePersonalDetails: (userId: string, details: PersonalDetails) => Promise<string | null>;
}

/** Chama a Edge Function `manage-users` e extrai a mensagem de erro dela. */
async function callManageUsers(action: string, payload: Record<string, unknown>): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.functions.invoke("manage-users", { body: { action, ...payload } });
  if (!error) return null;
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await error.context.json();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
        return body.error;
      }
    } catch {
      // resposta sem corpo legível: cai na mensagem genérica
    }
  }
  return GENERIC_ERROR;
}

export const useDirectoryStore = create<DirectoryState>((set, get) => {
  /** Roda a ação e, se deu certo, recarrega as listas. */
  async function run(action: () => Promise<string | null>): Promise<string | null> {
    const error = await action();
    if (!error) await get().load();
    return error;
  }

  return {
    schools: [],
    members: [],
    status: "idle",

    load: async () => {
      if (!supabase) return set({ status: "error" });
      set((s) => ({ status: s.status === "ready" ? "ready" : "loading" }));
      const [schools, profiles] = await Promise.all([
        supabase.from("schools").select("id, name"),
        supabase.from("profiles").select("id, role, school_id, full_name, last_name, email, active, avatar_path, elevated, nickname, birth_date"),
      ]);
      if (schools.error || profiles.error) return set({ status: "error" });
      set({
        status: "ready",
        schools: schools.data.map((s) => ({ id: s.id, name: s.name })),
        members: profiles.data.flatMap((p) =>
          isUserRole(p.role)
            ? [
                {
                  id: p.id,
                  role: p.role,
                  schoolId: p.school_id,
                  fullName: p.full_name,
                  lastName: p.last_name,
                  email: p.email ?? "",
                  active: p.active,
                  avatarUrl: avatarUrlOf(p.avatar_path),
                  elevated: p.role === "assistant" && p.elevated === true,
                  ...(typeof p.nickname === "string" && p.nickname ? { nickname: p.nickname } : {}),
                  ...(typeof p.birth_date === "string" && isValidISODate(p.birth_date)
                    ? { birthDate: p.birth_date }
                    : {}),
                },
              ]
            : [],
        ),
      });
    },

    createSchool: (schoolName, secretary) =>
      run(() =>
        callManageUsers("create_school", {
          school_name: schoolName.trim(),
          full_name: secretary.fullName.trim(),
          email: secretary.email.trim(),
          password: secretary.password,
        }),
      ),

    renameSchool: (id, name) =>
      run(async () => {
        if (!supabase) return GENERIC_ERROR;
        const { error } = await supabase.from("schools").update({ name: name.trim() }).eq("id", id);
        return error ? GENERIC_ERROR : null;
      }),

    deleteSchool: (id) => run(() => callManageUsers("delete_school", { school_id: id })),

    createMember: (input) =>
      run(() =>
        callManageUsers("create_member", {
          full_name: input.fullName.trim(),
          email: input.email.trim(),
          password: input.password,
          role: input.role,
        }),
      ),

    updateMember: (id, patch) =>
      run(() =>
        callManageUsers("update_user", {
          user_id: id,
          ...(patch.fullName !== undefined && { full_name: patch.fullName.trim() }),
          ...(patch.lastName !== undefined && { last_name: patch.lastName.trim() }),
          ...(patch.nickname !== undefined && { nickname: patch.nickname.trim() || null }),
          ...(patch.birthDate !== undefined && { birth_date: patch.birthDate || null }),
          ...(patch.email !== undefined && { email: patch.email.trim() }),
          ...(patch.role !== undefined && { role: patch.role }),
          ...(patch.removePhoto && { remove_photo: true }),
          ...(patch.password ? { password: patch.password } : {}),
          ...(patch.active !== undefined && { active: patch.active }),
          ...(patch.elevated !== undefined && { elevated: patch.elevated }),
        }),
      ),

    deleteMember: (id) => run(() => callManageUsers("delete_user", { user_id: id })),
    savePersonalDetails: (userId, details) => run(() => updatePersonalDetails(userId, details)),
  };
});
