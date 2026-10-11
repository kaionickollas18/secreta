import type { AttendanceData, AttendanceSettings, DataSource } from "../types/attendance";
import { isAttendanceData } from "../utils/attendanceSource";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/** Configuração (`school_settings`) e base offline (Storage) do dashboard de frequência. */

const BUCKET = "attendance-data";
const GENERIC_ERROR = "Não foi possível salvar. Verifique sua conexão e tente de novo.";
const fail = (error: string = GENERIC_ERROR) => ({ data: null, error });
/** Cada escola só enxerga a própria pasta (regra no banco). */
const filePath = (schoolId: string) => `${schoolId}/frequencia.json`;

export const EMPTY_SETTINGS: AttendanceSettings = {
  source: null,
  sheetUrl: "",
  classNames: [],
  hasFile: false,
};

interface SettingsRow {
  data_source: string | null;
  sheet_url: string | null;
  class_names: string[] | null;
  data_file_path: string | null;
  data_file_updated_at: string | null;
}

export async function fetchSettings(schoolId: string): Promise<ApiResult<AttendanceSettings>> {
  if (!supabase) return fail();
  const { data, error } = await supabase
    .from("school_settings")
    .select("data_source, sheet_url, class_names, data_file_path, data_file_updated_at")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) return fail("Não foi possível carregar a configuração do dashboard.");
  if (!data) return { data: EMPTY_SETTINGS, error: null };
  const row = data as SettingsRow;
  return {
    data: {
      source: row.data_source === "sheet" || row.data_source === "file" ? row.data_source : null,
      sheetUrl: row.sheet_url ?? "",
      classNames: row.class_names ?? [],
      hasFile: Boolean(row.data_file_path),
      fileUpdatedAt: row.data_file_updated_at ?? undefined,
    },
    error: null,
  };
}

export interface SettingsPatch {
  source?: DataSource | null;
  sheetUrl?: string;
  classNames?: string[];
  /** `false` registra que a base offline foi apagada; `true`, que foi enviada agora. */
  hasFile?: boolean;
}

export async function saveSettings(schoolId: string, patch: SettingsPatch): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const row: Record<string, unknown> = { school_id: schoolId, updated_at: new Date().toISOString() };
  if (patch.source !== undefined) row.data_source = patch.source;
  if (patch.sheetUrl !== undefined) row.sheet_url = patch.sheetUrl || null;
  if (patch.classNames !== undefined) row.class_names = patch.classNames;
  if (patch.hasFile !== undefined) {
    row.data_file_path = patch.hasFile ? filePath(schoolId) : null;
    row.data_file_updated_at = patch.hasFile ? new Date().toISOString() : null;
  }
  const { error } = await supabase.from("school_settings").upsert(row, { onConflict: "school_id" });
  return error ? GENERIC_ERROR : null;
}

export async function downloadOffline(schoolId: string): Promise<ApiResult<AttendanceData>> {
  if (!supabase) return fail();
  const { data, error } = await supabase.storage.from(BUCKET).download(filePath(schoolId));
  if (error || !data) return fail("Não foi possível abrir a base offline.");
  try {
    const parsed: unknown = JSON.parse(await data.text());
    if (isAttendanceData(parsed)) return { data: parsed, error: null };
  } catch {
    // JSON inválido: cai no erro abaixo
  }
  return fail("A base offline está em um formato inválido. Envie os arquivos novamente.");
}

export async function uploadOffline(schoolId: string, content: AttendanceData): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const blob = new Blob([JSON.stringify(content)], { type: "application/json" });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath(schoolId), blob, { upsert: true, contentType: "application/json" });
  return error ? "Não foi possível enviar a base offline." : null;
}

export async function removeOffline(schoolId: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.storage.from(BUCKET).remove([filePath(schoolId)]);
  return error ? "Não foi possível apagar a base offline." : null;
}
