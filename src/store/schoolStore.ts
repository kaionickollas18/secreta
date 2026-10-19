import { create } from "zustand";
import type { SchoolIdentity, SchoolIdentityForm } from "../types/school";
import { EMPTY_IDENTITY } from "../utils/schoolIdentity";
import { fetchIdentity, removeLogo, saveIdentity, uploadLogo } from "./schoolApi";

interface SchoolState {
  identity: SchoolIdentity;
  status: "idle" | "loading" | "ready" | "error";
  load: (schoolId: string) => Promise<void>;
  /** Cada ação devolve a mensagem de erro, ou `null` se deu certo. */
  save: (schoolId: string, form: SchoolIdentityForm) => Promise<string | null>;
  /** `image` já vem reduzida. */
  saveLogo: (schoolId: string, image: Blob) => Promise<string | null>;
  removeLogo: (schoolId: string) => Promise<string | null>;
}

export const useSchoolStore = create<SchoolState>((set, get) => ({
  identity: EMPTY_IDENTITY,
  status: "idle",

  load: async (schoolId) => {
    set((s) => ({ status: s.status === "ready" ? "ready" : "loading" }));
    const result = await fetchIdentity(schoolId);
    if (result.error !== null) return set({ status: "error" });
    set({ status: "ready", identity: result.data });
  },

  save: async (schoolId, form) => {
    const error = await saveIdentity(schoolId, form);
    if (!error) set((s) => ({ identity: { ...s.identity, ...form } }));
    return error;
  },

  saveLogo: async (schoolId, image) => {
    const result = await uploadLogo(schoolId, image, get().identity.logoPath);
    if (result.error !== null) return result.error;
    set((s) => ({ identity: { ...s.identity, logoPath: result.data.path, logoUrl: result.data.url } }));
    return null;
  },

  removeLogo: async (schoolId) => {
    const { logoPath } = get().identity;
    if (!logoPath) return null;
    const error = await removeLogo(schoolId, logoPath);
    if (!error) {
      const { officialName, inep, address, cep, decree } = get().identity;
      set({ identity: { officialName, inep, address, cep, decree } });
    }
    return error;
  },
}));
