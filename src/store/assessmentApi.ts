import type { AnswerSheet, Assessment } from "../types/assessment";
import {
  ASSESSMENT_COLUMNS,
  assessmentFromRow,
  assessmentToRow,
  rowsOf,
  SHEET_COLUMNS,
  sheetFromRow,
  sheetToRow,
} from "../utils/assessmentRows";
import { isAnswerSheet, isAssessment } from "../utils/assessments";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/*
 * Avaliações (`assessments`) e cartões corrigidos (`answer_sheets`) no Supabase. Só a secretaria
 * da escola lê e grava; só o secretário exclui avaliações (regras no banco, 0023).
 */

const LOAD_FAIL = "Não foi possível carregar as avaliações.";
const SAVE_FAIL = "Não foi possível salvar a avaliação. Tente de novo.";
const SHEET_FAIL = "Não foi possível salvar o cartão. Tente de novo.";
const DELETE_FAIL = "Não foi possível excluir. Tente de novo.";
/** A API devolve no máximo 1000 linhas por pedido: os cartões vêm em páginas. */
const PAGE = 1000;

type Page = PromiseLike<{ data: unknown[] | null; error: unknown }>;

async function fetchAll(query: (from: number, to: number) => Page): Promise<unknown[] | null> {
  const all: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error || !data) return null;
    all.push(...data);
    if (data.length < PAGE) return all;
  }
}

const errorCode = (error: unknown): string =>
  typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";

export async function fetchAssessments(
  schoolId: string,
): Promise<ApiResult<{ assessments: Assessment[]; sheets: AnswerSheet[] }>> {
  const db = supabase;
  if (!db) return { data: null, error: LOAD_FAIL };
  const [assessments, sheets] = await Promise.all([
    db.from("assessments").select(ASSESSMENT_COLUMNS).eq("school_id", schoolId),
    fetchAll((from, to) =>
      db.from("answer_sheets").select(SHEET_COLUMNS).eq("school_id", schoolId).order("id").range(from, to),
    ),
  ]);
  if (assessments.error || !sheets) return { data: null, error: LOAD_FAIL };
  return {
    data: { assessments: rowsOf(assessments.data, assessmentFromRow), sheets: rowsOf(sheets, sheetFromRow) },
    error: null,
  };
}

/** Cria ou substitui a avaliação (pelo id). */
export async function saveAssessment(schoolId: string, assessment: Assessment): Promise<ApiResult<Assessment>> {
  if (!isAssessment(assessment)) return { data: null, error: "A avaliação tem dados inválidos." };
  if (!supabase) return { data: null, error: SAVE_FAIL };
  const { data, error } = await supabase
    .from("assessments")
    .upsert(assessmentToRow(schoolId, assessment), { onConflict: "id" })
    .select(ASSESSMENT_COLUMNS)
    .single();
  if (error) {
    return {
      data: null,
      error: errorCode(error) === "23505" ? "Já existe outra avaliação com este código de cartão." : SAVE_FAIL,
    };
  }
  const saved = assessmentFromRow(data);
  return saved ? { data: saved, error: null } : { data: null, error: SAVE_FAIL };
}

/** Exclui a avaliação; os cartões dela saem junto (on delete cascade). */
export async function deleteAssessment(_schoolId: string, assessmentId: string): Promise<string | null> {
  if (!supabase) return DELETE_FAIL;
  const { data, error } = await supabase.from("assessments").delete().eq("id", assessmentId).select("id");
  if (error) return DELETE_FAIL;
  // Sem linha apagada: a regra do banco não deixou (só o secretário exclui avaliações).
  return Array.isArray(data) && data.length > 0 ? null : "Só o secretário pode excluir avaliações.";
}

/** Grava o cartão. Um aluno tem um cartão por avaliação: o novo substitui o anterior. */
export async function saveSheet(schoolId: string, sheet: AnswerSheet): Promise<ApiResult<AnswerSheet>> {
  if (!isAnswerSheet(sheet) || sheet.slot < 1) return { data: null, error: "O cartão tem dados inválidos." };
  if (!supabase) return { data: null, error: SHEET_FAIL };
  // Cartão salvo que mudou de aluno na revisão: sai do aluno antigo antes de ocupar o novo.
  const moved = await supabase.from("answer_sheets").delete().eq("id", sheet.id).neq("slot", sheet.slot);
  if (moved.error) return { data: null, error: SHEET_FAIL };
  const { data, error } = await supabase
    .from("answer_sheets")
    .upsert(sheetToRow(schoolId, sheet), { onConflict: "assessment_id,slot" })
    .select(SHEET_COLUMNS)
    .single();
  const saved = error ? null : sheetFromRow(data);
  return saved ? { data: saved, error: null } : { data: null, error: SHEET_FAIL };
}

export async function deleteSheet(_schoolId: string, sheetId: string): Promise<string | null> {
  if (!supabase) return DELETE_FAIL;
  const { error } = await supabase.from("answer_sheets").delete().eq("id", sheetId);
  return error ? DELETE_FAIL : null;
}
