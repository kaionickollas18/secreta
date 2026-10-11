import type { Reminder, ReminderInput, Schedule } from "../types/reminder";
import { todayISO } from "../utils/date";
import { completionKey } from "../utils/reminders";
import { supabase } from "./supabaseClient";
import type { ApiResult } from "./taskApi";

/** Acesso às tabelas `reminders` e `reminder_completions`. */

const GENERIC_ERROR = "Não foi possível salvar. Verifique sua conexão e tente de novo.";
const fail = (error: string = GENERIC_ERROR) => ({ data: null, error });

const COLUMNS =
  "id, title, notes, kind, due_date, weekday, interval_months, start_month, day_start, day_end, created_at";

interface ReminderRow {
  id: string;
  title: string;
  notes: string | null;
  kind: string;
  due_date: string | null;
  weekday: number | null;
  interval_months: number | null;
  start_month: string | null;
  day_start: number | null;
  day_end: number | null;
  created_at: string;
}

/** Converte a linha do banco. Devolve `null` se a recorrência estiver incompleta. */
export function reminderFromRow(row: ReminderRow): Reminder | null {
  let schedule: Schedule | null = null;
  if (row.kind === "once" && row.due_date) {
    schedule = { kind: "once", dueDate: row.due_date };
  } else if (row.kind === "weekly" && row.weekday !== null) {
    schedule = { kind: "weekly", weekday: row.weekday };
  } else if (
    row.kind === "monthly" &&
    row.interval_months !== null &&
    row.start_month &&
    row.day_start !== null &&
    row.day_end !== null
  ) {
    schedule = {
      kind: "monthly",
      intervalMonths: row.interval_months,
      startMonth: row.start_month.slice(0, 7),
      dayStart: row.day_start,
      dayEnd: row.day_end,
    };
  }
  if (!schedule) return null;
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    schedule,
    createdOn: todayISO(new Date(row.created_at)),
  };
}

/** Campos no formato do banco; os que não pertencem ao tipo de recorrência vão como `null`. */
export function reminderToRow(input: ReminderInput) {
  const { schedule } = input;
  return {
    title: input.title,
    notes: input.notes ?? null,
    kind: schedule.kind,
    due_date: schedule.kind === "once" ? schedule.dueDate : null,
    weekday: schedule.kind === "weekly" ? schedule.weekday : null,
    interval_months: schedule.kind === "monthly" ? schedule.intervalMonths : null,
    start_month: schedule.kind === "monthly" ? `${schedule.startMonth}-01` : null,
    day_start: schedule.kind === "monthly" ? schedule.dayStart : null,
    day_end: schedule.kind === "monthly" ? schedule.dayEnd : null,
  };
}

export async function fetchReminders(): Promise<ApiResult<{ reminders: Reminder[]; doneKeys: string[] }>> {
  if (!supabase) return fail();
  const [reminders, completions] = await Promise.all([
    supabase.from("reminders").select(COLUMNS),
    supabase.from("reminder_completions").select("reminder_id, period_key"),
  ]);
  if (reminders.error || completions.error) return fail("Não foi possível carregar os lembretes.");
  return {
    data: {
      reminders: (reminders.data as ReminderRow[]).flatMap((row) => reminderFromRow(row) ?? []),
      doneKeys: (completions.data as { reminder_id: string; period_key: string }[]).map((c) =>
        completionKey(c.reminder_id, c.period_key),
      ),
    },
    error: null,
  };
}

/** Cria (sem `id`) ou atualiza um lembrete. */
export async function saveReminder(
  schoolId: string,
  input: ReminderInput,
  id?: string,
): Promise<ApiResult<Reminder>> {
  if (!supabase) return fail();
  const row = reminderToRow(input);
  const query = id
    ? supabase.from("reminders").update(row).eq("id", id)
    : supabase.from("reminders").insert({ ...row, school_id: schoolId });
  const { data, error } = await query.select(COLUMNS).single();
  if (error) return fail();
  const reminder = reminderFromRow(data as ReminderRow);
  return reminder ? { data: reminder, error: null } : fail();
}

export async function removeReminder(id: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  return error ? GENERIC_ERROR : null;
}

/** Marca (ou desmarca) um ciclo do lembrete como feito. */
export async function setCompletion(
  schoolId: string,
  reminderId: string,
  periodKey: string,
  done: boolean,
): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR;
  const { error } = done
    ? await supabase
        .from("reminder_completions")
        .upsert({ reminder_id: reminderId, period_key: periodKey, school_id: schoolId })
    : await supabase
        .from("reminder_completions")
        .delete()
        .eq("reminder_id", reminderId)
        .eq("period_key", periodKey);
  return error ? GENERIC_ERROR : null;
}
