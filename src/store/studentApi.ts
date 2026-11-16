import type { StudentRecord } from "../types/student";
import { studentFromRow } from "../utils/students";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/** Cadastro dos alunos (`students`). Só secretário e assistentes leem (regra no banco). */

const COLUMNS =
  "school_year, class_name, name, sex, birth_date, guardian_name, guardian_nis, phone, address, neighborhood, cep";
/** Acima do padrão de 1000 linhas da API: uma escola cabe com folga. */
const MAX_ROWS = 5000;

export async function fetchStudents(schoolId: string): Promise<ApiResult<StudentRecord[]>> {
  if (!supabase) return { data: null, error: "Não foi possível carregar o cadastro dos alunos." };
  const { data, error } = await supabase
    .from("students")
    .select(COLUMNS)
    .eq("school_id", schoolId)
    .order("school_year", { ascending: false })
    .range(0, MAX_ROWS - 1);
  if (error) return { data: null, error: "Não foi possível carregar o cadastro dos alunos." };
  const rows: unknown[] = Array.isArray(data) ? data : [];
  return {
    data: rows.map(studentFromRow).filter((record): record is StudentRecord => record !== null),
    error: null,
  };
}
