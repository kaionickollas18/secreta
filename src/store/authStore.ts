import { create } from "zustand";
import type { AuthStatus, Profile } from "../types/auth";
import { isUserRole } from "../utils/guards";
import { loginErrorMessage } from "../utils/authErrors";
import { supabase } from "./supabaseClient";

interface AuthState {
  status: AuthStatus;
  profile: Profile | null;
  error: string | null;
  /** Começa a ouvir a sessão. Devolve a função que para de ouvir. */
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/** `false` quando faltam as variáveis do Supabase no build (o app mostra um aviso). */
export const supabaseConfigured = supabase !== null;

const NO_ACCESS = "Seu acesso não está liberado. Procure o responsável pela sua escola.";

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, school_id, full_name, last_name, active")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || !data.active || !isUserRole(data.role)) return null;
  return {
    id: data.id,
    role: data.role,
    schoolId: data.school_id,
    fullName: data.full_name,
    lastName: data.last_name,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  profile: null,
  error: null,

  init: () => {
    if (!supabase) {
      set({ status: "signedOut" });
      return () => {};
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        set({ status: "signedOut", profile: null });
        return;
      }
      // Renovação de token não muda quem está logado.
      if (event === "TOKEN_REFRESHED" && get().profile?.id === session.user.id) return;
      // Não chamar o Supabase direto dentro do callback (pode travar); adia um ciclo.
      setTimeout(() => {
        void fetchProfile(session.user.id).then(async (profile) => {
          if (profile) {
            set({ status: "signedIn", profile, error: null });
          } else {
            set({ status: "signedOut", profile: null, error: NO_ACCESS });
            await supabase?.auth.signOut();
          }
        });
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    if (!supabase) return;
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) set({ error: loginErrorMessage(error) });
  },

  signOut: async () => {
    await supabase?.auth.signOut();
    set({ status: "signedOut", profile: null, error: null });
  },
}));
