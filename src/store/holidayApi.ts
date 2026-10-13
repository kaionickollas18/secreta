import type { Holiday, HolidayInput } from "../types/calendar";
import { holidayFromRow } from "../utils/holidays";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/** Acesso à tabela `holidays` (feriados e recessos cadastrados pela escola). */

const GENERIC_ERROR = "Não foi possível salvar. Verifique sua conexão e tente de novo.";
const fail = (error: string = GENERIC_ERROR) => ({ data: null, error });

const COLUMNS = "id, name, starts_on, ends_on";
type Row = Parameters<typeof holidayFromRow>[0];

export async function fetchHolidays(): Promise<ApiResult<Holiday[]>> {
  if (!supabase) return fail();
  const { data, error } = await supabase.from("holidays").select(COLUMNS);
  if (error) return fail("Não foi possível carregar os feriados.");
  return { data: (data as Row[]).flatMap((row) => holidayFromRow(row) ?? []), error: null };
}

/** Cria (sem `id`) ou atualiza um feriado. */
export async function saveHoliday(
  schoolId: string,
  input: HolidayInput,
  id?: string,
): Promise<ApiResult<Holiday>> {
  if (!supabase) return fail();
  const row = { name: input.name, starts_on: input.start, ends_on: input.end };
  const query = id
    ? supabase.from("holidays").update(row).eq("id", id)
    : supabase.from("holidays").insert({ ...row, school_id: schoolId });
  const { data, error } = await query.select(COLUMNS).single();
  if (error) return fail();
  const holiday = holidayFromRow(data as Row);
  return holiday ? { data: holiday, error: null } : fail();
}

export async function removeHoliday(id: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.from("holidays").delete().eq("id", id);
  return error ? GENERIC_ERROR : null;
}
