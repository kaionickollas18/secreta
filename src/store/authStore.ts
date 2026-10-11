import { create } from "zustand";
import type { AuthStatus, Profile } from "../types/auth";
import { isUserRole } from "../utils/guards";
import { loginErrorMessage } from "../utils/authErrors";
import { parseCachedProfile, PROFILE_CACHE_KEY } from "../utils/profileCache";
import { avatarUrlOf, changePassword, removeAvatar, updateLastName, uploadAvatar } from "./profileApi";
import { supabase } from "./supabaseClient";

interface AuthState {
  status: AuthStatus;
  profile: Profile | null;
  error: string | null;
  /** Começa a ouvir a sessão. Devolve a função que para de ouvir. */
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Perfil próprio. Cada ação devolve a mensagem de erro, ou `null` se deu certo. */
  saveLastName: (lastName: string) => Promise<string | null>;
  /** `image` já vem recortada e reduzida. */
  savePhoto: (image: Blob) => Promise<string | null>;
  removePhoto: () => Promise<string | null>;
  changePassword: (current: string, next: string) => Promise<string | null>;
}

/** `false` quando faltam as variáveis do Supabase no build (o app mostra um aviso). */
export const supabaseConfigured = supabase !== null;

const NO_ACCESS = "Seu acesso não está liberado. Procure o responsável pela sua escola.";
const NOT_SIGNED_IN = "Sessão expirada. Entre de novo e tente outra vez.";

/**
 * Perfil da última sessão neste navegador. Permite desenhar a moldura na hora, a cada
 * troca de página, enquanto o Supabase confirma a sessão. Não concede nada: as regras
 * valem no banco, e o perfil é conferido de novo em toda página.
 */
function readCachedProfile(): Profile | null {
  if (!supabase) return null;
  try {
    return parseCachedProfile(window.localStorage.getItem(PROFILE_CACHE_KEY));
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: Profile | null): void {
  try {
    if (profile) window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    else window.localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // sem armazenamento local: a moldura só aparece depois de confirmar a sessão
  }
}

/** `unreachable`: não deu para consultar (rede fora do ar). `null`: sem perfil ou desativado. */
async function fetchProfile(userId: string): Promise<Profile | null | "unreachable"> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, school_id, full_name, last_name, active, avatar_path")
    .eq("id", userId)
    .maybeSingle();
  if (error) return "unreachable";
  if (!data || !data.active || !isUserRole(data.role)) return null;
  return {
    id: data.id,
    role: data.role,
    schoolId: data.school_id,
    fullName: data.full_name,
    lastName: data.last_name,
    ...(data.avatar_path ? { avatarPath: data.avatar_path, avatarUrl: avatarUrlOf(data.avatar_path) } : {}),
  };
}

const cachedProfile = readCachedProfile();

export const useAuthStore = create<AuthState>((set, get) => ({
  status: cachedProfile ? "signedIn" : "loading",
  profile: cachedProfile,
  error: null,

  init: () => {
    if (!supabase) {
      set({ status: "signedOut" });
      return () => {};
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        writeCachedProfile(null);
        set({ status: "signedOut", profile: null });
        return;
      }
      // Renovação de token não muda quem está logado.
      if (event === "TOKEN_REFRESHED" && get().profile?.id === session.user.id) return;
      // O perfil guardado é de outra pessoa: não mostrar nada dela enquanto confirma.
      const shown = get().profile;
      if (shown && shown.id !== session.user.id) set({ status: "loading", profile: null });
      // Não chamar o Supabase direto dentro do callback (pode travar); adia um ciclo.
      setTimeout(() => {
        void fetchProfile(session.user.id).then(async (profile) => {
          if (profile === "unreachable") {
            // Internet instável: quem já está com a moldura aberta continua nela, em vez de
            // ser deslogado por uma falha passageira. Sem perfil conhecido, volta ao login.
            if (get().profile?.id === session.user.id) return;
            set({
              status: "signedOut",
              profile: null,
              error: "Sem conexão. Verifique sua internet e tente de novo.",
            });
            return;
          }
          if (profile) {
            writeCachedProfile(profile);
            set({ status: "signedIn", profile, error: null });
          } else {
            writeCachedProfile(null);
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
    writeCachedProfile(null);
    await supabase?.auth.signOut();
    set({ status: "signedOut", profile: null, error: null });
  },

  saveLastName: async (lastName) => {
    const profile = get().profile;
    if (!profile) return NOT_SIGNED_IN;
    const error = await updateLastName(profile.id, lastName);
    if (!error) applyProfile({ ...profile, lastName });
    return error;
  },

  savePhoto: async (image) => {
    const profile = get().profile;
    if (!profile) return NOT_SIGNED_IN;
    const result = await uploadAvatar(profile.id, image, profile.avatarPath);
    if (result.error !== null) return result.error;
    applyProfile({ ...profile, avatarPath: result.data.path, avatarUrl: result.data.url });
    return null;
  },

  removePhoto: async () => {
    const profile = get().profile;
    if (!profile) return NOT_SIGNED_IN;
    if (!profile.avatarPath) return null;
    const error = await removeAvatar(profile.id, profile.avatarPath);
    if (!error) {
      // Recria o perfil sem os campos da foto.
      applyProfile({
        id: profile.id,
        role: profile.role,
        schoolId: profile.schoolId,
        fullName: profile.fullName,
        lastName: profile.lastName,
      });
    }
    return error;
  },

  changePassword: (current, next) => changePassword(current, next),
}));

/** Atualiza o perfil na tela e na cópia guardada no navegador. */
function applyProfile(profile: Profile): void {
  writeCachedProfile(profile);
  useAuthStore.setState({ profile });
}
