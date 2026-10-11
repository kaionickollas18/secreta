import { create } from "zustand";
import { loadAttendance } from "../data/loadAttendance";
import type {
  AttendanceData,
  AttendanceSettings,
  AttendanceStatus,
  ClassData,
  DataSource,
} from "../types/attendance";
import { extractSheetId, mergeClasses } from "../utils/attendanceSource";
import {
  downloadOffline,
  EMPTY_SETTINGS,
  fetchSettings,
  removeOffline,
  saveSettings,
  uploadOffline,
} from "./attendanceApi";

interface AttendanceState {
  settings: AttendanceSettings;
  /** Dados em exibição. `null` enquanto não há nada para mostrar. */
  data: AttendanceData | null;
  /** Cópia da base offline (para listar/editar as turmas enviadas). */
  offline: AttendanceData | null;
  status: AttendanceStatus;
  refreshing: boolean;
  /** Lê a configuração da escola e carrega os dados. */
  init: (schoolId: string) => Promise<void>;
  /** Recarrega os dados da fonte configurada. */
  refresh: (schoolId: string) => Promise<void>;
  /** Baixa a base offline para listar as turmas (quando a fonte em uso é a planilha). */
  loadOffline: (schoolId: string) => Promise<void>;
  /** As ações abaixo devolvem a mensagem de erro, ou `null` se deu certo. */
  saveSheet: (schoolId: string, sheetUrl: string, classNames: string[]) => Promise<string | null>;
  setSource: (schoolId: string, source: DataSource) => Promise<string | null>;
  /** Junta as turmas enviadas à base offline (substitui as de mesmo nome). */
  addOfflineClasses: (schoolId: string, classes: ClassData[]) => Promise<string | null>;
  removeOfflineClass: (schoolId: string, className: string) => Promise<string | null>;
  clearOffline: (schoolId: string) => Promise<string | null>;
}

/** Só a resposta do pedido mais recente vale (evita que uma resposta antiga sobrescreva a nova). */
let requestSeq = 0;

export const useAttendanceStore = create<AttendanceState>((set, get) => {
  /** Grava a base offline inteira e atualiza a configuração. */
  async function writeOffline(schoolId: string, classes: ClassData[]): Promise<string | null> {
    const content: AttendanceData = { generatedAt: new Date().toISOString(), classes };
    const error = await uploadOffline(schoolId, content);
    if (error) return error;
    const { settings } = get();
    // Primeira base enviada sem nenhuma fonte definida: passa a ser a fonte em uso.
    const source = settings.source ?? "file";
    const saveError = await saveSettings(schoolId, { hasFile: true, source });
    if (saveError) return saveError;
    set({
      offline: content,
      settings: { ...settings, source, hasFile: true, fileUpdatedAt: content.generatedAt },
    });
    await get().refresh(schoolId);
    return null;
  }

  /** Base offline atual (da memória ou baixada). Sem base: lista vazia. */
  async function currentOffline(schoolId: string): Promise<ClassData[] | string> {
    const { offline, settings } = get();
    if (offline) return offline.classes;
    if (!settings.hasFile) return [];
    const result = await downloadOffline(schoolId);
    return result.error !== null ? result.error : result.data.classes;
  }

  return {
    settings: EMPTY_SETTINGS,
    data: null,
    offline: null,
    status: "loading",
    refreshing: false,

    init: async (schoolId) => {
      const result = await fetchSettings(schoolId);
      if (result.error !== null) return set({ status: "error" });
      set({ settings: result.data });
      await get().refresh(schoolId);
    },

    refresh: async (schoolId) => {
      const seq = (requestSeq += 1);
      const { settings } = get();
      const finish = (patch: Partial<AttendanceState>) => {
        if (seq === requestSeq) set({ ...patch, refreshing: false });
      };
      if (!settings.source) return finish({ status: "unconfigured", data: null });
      set({ refreshing: true });

      if (settings.source === "sheet") {
        const sheetId = extractSheetId(settings.sheetUrl);
        try {
          if (!sheetId) throw new Error("link inválido");
          const data = await loadAttendance(sheetId, settings.classNames);
          return finish({ status: "live", data });
        } catch {
          // Planilha indisponível: tenta a base offline abaixo.
        }
      }

      if (settings.hasFile) {
        const result = await downloadOffline(schoolId);
        if (result.error === null) {
          return finish({
            status: settings.source === "sheet" ? "fallback" : "file",
            data: result.data,
            offline: result.data,
          });
        }
      }
      // Mantém na tela o que já estava carregado, se houver.
      finish({ status: "error" });
    },

    loadOffline: async (schoolId) => {
      const existing = await currentOffline(schoolId);
      if (typeof existing !== "string" && !get().offline && get().settings.hasFile) {
        set({ offline: { generatedAt: get().settings.fileUpdatedAt ?? "", classes: existing } });
      }
    },

    saveSheet: async (schoolId, sheetUrl, classNames) => {
      const error = await saveSettings(schoolId, { sheetUrl, classNames, source: "sheet" });
      if (error) return error;
      set((s) => ({ settings: { ...s.settings, sheetUrl, classNames, source: "sheet" } }));
      await get().refresh(schoolId);
      return null;
    },

    setSource: async (schoolId, source) => {
      const error = await saveSettings(schoolId, { source });
      if (error) return error;
      set((s) => ({ settings: { ...s.settings, source } }));
      await get().refresh(schoolId);
      return null;
    },

    addOfflineClasses: async (schoolId, classes) => {
      const existing = await currentOffline(schoolId);
      if (typeof existing === "string") return existing;
      return writeOffline(schoolId, mergeClasses(existing, classes));
    },

    removeOfflineClass: async (schoolId, className) => {
      const existing = await currentOffline(schoolId);
      if (typeof existing === "string") return existing;
      const remaining = existing.filter((c) => c.name !== className);
      return remaining.length === 0 ? get().clearOffline(schoolId) : writeOffline(schoolId, remaining);
    },

    clearOffline: async (schoolId) => {
      const error = await removeOffline(schoolId);
      if (error) return error;
      const { settings } = get();
      // Sem a base, a fonte "arquivo" deixa de existir.
      const source = settings.source === "file" ? null : settings.source;
      const saveError = await saveSettings(schoolId, { hasFile: false, source });
      if (saveError) return saveError;
      set({ offline: null, settings: { ...settings, source, hasFile: false, fileUpdatedAt: undefined } });
      await get().refresh(schoolId);
      return null;
    },
  };
});
