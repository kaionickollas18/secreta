import { describe, expect, it } from "vitest";
import type { Reminder, ReminderFormValues, Schedule } from "../types/reminder";
import {
  completionKey,
  countDue,
  describeSchedule,
  emptyReminderForm,
  reminderStatus,
  reminderToForm,
  sortByUrgency,
  statusLabel,
  validateReminderForm,
} from "../utils/reminders";

function reminder(schedule: Schedule, overrides: Partial<Reminder> = {}): Reminder {
  return { id: "r1", title: "Lembrete", schedule, createdOn: "2026-10-01", ...overrides };
}

const NONE: ReadonlySet<string> = new Set();
const done = (periodKey: string, id = "r1") => new Set([completionKey(id, periodKey)]);

// Memorando: todo mês, do dia 15 ao dia 20.
const memo = reminder({ kind: "monthly", intervalMonths: 1, startMonth: "2026-10", dayStart: 15, dayEnd: 20 });
// Sistema Presença: a cada 2 meses, do dia 1 ao dia 10.
const presenca = reminder({ kind: "monthly", intervalMonths: 2, startMonth: "2026-10", dayStart: 1, dayEnd: 10 });

describe("lembrete mensal com período de dias", () => {
  it("antes do dia 15 está por vir", () => {
    const status = reminderStatus(memo, NONE, "2026-10-10");
    expect(status).toMatchObject({ state: "upcoming", days: 5 });
    expect(status.occurrence).toEqual({ periodKey: "2026-10", start: "2026-10-15", end: "2026-10-20" });
    expect(statusLabel(status)).toBe("Começa em 5 dias (15/10/2026)");
  });

  it("do dia 15 ao 20 está no prazo", () => {
    expect(reminderStatus(memo, NONE, "2026-10-15")).toMatchObject({ state: "active", days: 5 });
    expect(statusLabel(reminderStatus(memo, NONE, "2026-10-19"))).toBe("No prazo: falta 1 dia");
    expect(statusLabel(reminderStatus(memo, NONE, "2026-10-20"))).toBe("Vence hoje");
  });

  it("depois do dia 20 fica atrasado até o próximo ciclo começar", () => {
    expect(reminderStatus(memo, NONE, "2026-10-21")).toMatchObject({ state: "overdue", days: 1 });
    expect(statusLabel(reminderStatus(memo, NONE, "2026-10-21"))).toBe("Atrasado há 1 dia");
    expect(reminderStatus(memo, NONE, "2026-11-14")).toMatchObject({ state: "overdue", days: 25 });
    const november = reminderStatus(memo, NONE, "2026-11-15");
    expect(november.state).toBe("active");
    expect(november.occurrence?.periodKey).toBe("2026-11");
  });

  it("marcado como feito mostra o próximo ciclo; cada ciclo é independente", () => {
    const status = reminderStatus(memo, done("2026-10"), "2026-10-25");
    expect(status.state).toBe("done");
    expect(statusLabel(status)).toBe("Feito. Próximo: 15/11/2026");
    expect(reminderStatus(memo, done("2026-10"), "2026-11-16").state).toBe("active");
  });

  it("não cobra um ciclo que terminou antes de o lembrete ser criado", () => {
    const late = { ...memo, createdOn: "2026-10-25" };
    const status = reminderStatus(late, NONE, "2026-10-25");
    expect(status).toMatchObject({ state: "upcoming", days: 21 });
    expect(status.occurrence?.periodKey).toBe("2026-11");
  });

  it("ajusta dias que não existem no mês (30 e 31 em fevereiro)", () => {
    const endOfMonth = reminder(
      { kind: "monthly", intervalMonths: 1, startMonth: "2027-02", dayStart: 30, dayEnd: 31 },
      { createdOn: "2027-02-01" },
    );
    expect(reminderStatus(endOfMonth, NONE, "2027-02-28")).toMatchObject({
      state: "active",
      days: 0,
      occurrence: { periodKey: "2027-02", start: "2027-02-28", end: "2027-02-28" },
    });
  });
});

describe("lembrete a cada 2 meses", () => {
  it("só cai nos meses do intervalo", () => {
    const november = reminderStatus(presenca, NONE, "2026-11-20");
    expect(november.state).toBe("overdue");
    expect(november.occurrence?.periodKey).toBe("2026-10");
    expect(november.next?.start).toBe("2026-12-01");

    const afterDone = reminderStatus(presenca, done("2026-10"), "2026-11-20");
    expect(statusLabel(afterDone)).toBe("Feito. Próximo: 01/12/2026");
    expect(reminderStatus(presenca, done("2026-10"), "2026-12-05").occurrence?.periodKey).toBe("2026-12");
  });

  it("antes do mês de início está por vir", () => {
    expect(reminderStatus(presenca, NONE, "2026-09-20")).toMatchObject({ state: "upcoming", days: 11 });
  });

  it("atravessa a virada do ano", () => {
    const status = reminderStatus(presenca, NONE, "2027-02-03");
    expect(status.occurrence?.periodKey).toBe("2027-02");
    expect(status.state).toBe("active");
  });
});

describe("lembrete semanal e único", () => {
  // 12/10/2026 é segunda-feira.
  const monday = reminder({ kind: "weekly", weekday: 1 });

  it("semanal: no dia está no prazo; depois, atrasado até a semana seguinte", () => {
    expect(reminderStatus(monday, NONE, "2026-10-12")).toMatchObject({ state: "active", days: 0 });
    const wednesday = reminderStatus(monday, NONE, "2026-10-14");
    expect(wednesday).toMatchObject({ state: "overdue", days: 2 });
    expect(wednesday.next?.start).toBe("2026-10-19");
    expect(reminderStatus(monday, done("2026-10-12"), "2026-10-14").state).toBe("done");
  });

  it("semanal criado no meio da semana começa na próxima ocorrência", () => {
    const status = reminderStatus({ ...monday, createdOn: "2026-10-13" }, NONE, "2026-10-14");
    expect(status).toMatchObject({ state: "upcoming", days: 5 });
  });

  it("único: por vir, no dia, atrasado e concluído", () => {
    const once = reminder({ kind: "once", dueDate: "2026-10-20" });
    expect(reminderStatus(once, NONE, "2026-10-10")).toMatchObject({ state: "upcoming", days: 10 });
    expect(reminderStatus(once, NONE, "2026-10-20").state).toBe("active");
    expect(reminderStatus(once, NONE, "2026-10-22")).toMatchObject({ state: "overdue", days: 2 });
    const finished = reminderStatus(once, done("once"), "2026-10-22");
    expect(finished.state).toBe("finished");
    expect(statusLabel(finished)).toBe("Concluído");
  });
});

describe("textos, ordenação e contagem", () => {
  it("descreve a repetição em português", () => {
    expect(describeSchedule(memo.schedule)).toBe("Todo mês, do dia 15 ao dia 20");
    expect(describeSchedule(presenca.schedule)).toBe("A cada 2 meses, do dia 1 ao dia 10");
    expect(
      describeSchedule({ kind: "monthly", intervalMonths: 1, startMonth: "2026-10", dayStart: 5, dayEnd: 5 }),
    ).toBe("Todo mês, no dia 5");
    expect(describeSchedule({ kind: "weekly", weekday: 1 })).toBe("Toda segunda-feira");
    expect(describeSchedule({ kind: "weekly", weekday: 6 })).toBe("Todo sábado");
    expect(describeSchedule({ kind: "once", dueDate: "2026-10-20" })).toBe("Uma vez, em 20/10/2026");
  });

  it("ordena: atrasados, no prazo, por vir e feitos", () => {
    const today = "2026-10-16";
    const list = [
      { ...memo, id: "feito", title: "Feito" },
      { ...memo, id: "prazo", title: "No prazo" },
      { ...presenca, id: "atrasado", title: "Atrasado" },
      reminder({ kind: "once", dueDate: "2026-10-30" }, { id: "futuro", title: "Futuro" }),
    ];
    const keys = done("2026-10", "feito");
    const sorted = sortByUrgency(list.map((r) => ({ reminder: r, status: reminderStatus(r, keys, today) })));
    expect(sorted.map((i) => i.reminder.id)).toEqual(["atrasado", "prazo", "futuro", "feito"]);
    expect(countDue(list, keys, today)).toBe(2);
  });
});

describe("validateReminderForm", () => {
  const today = "2026-10-10";
  const base: ReminderFormValues = {
    ...emptyReminderForm(today),
    title: "  Entregar memorando ",
    dayStart: "15",
    dayEnd: "20",
  };

  it("aceita o lembrete mensal e normaliza os campos", () => {
    const result = validateReminderForm(base, today);
    expect(result).toEqual({
      valid: true,
      value: {
        title: "Entregar memorando",
        notes: undefined,
        schedule: { kind: "monthly", intervalMonths: 1, startMonth: "2026-10", dayStart: 15, dayEnd: 20 },
      },
    });
  });

  it("exige título e dias coerentes", () => {
    const result = validateReminderForm({ ...base, title: " ", dayStart: "20", dayEnd: "15" }, today);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.title).toBeDefined();
      expect(result.errors.dayEnd).toBe("O último dia não pode vir antes do primeiro.");
    }
    const outOfRange = validateReminderForm({ ...base, dayStart: "0", dayEnd: "32" }, today);
    expect(!outOfRange.valid && outOfRange.errors).toMatchObject({
      dayStart: "Informe um dia de 1 a 31.",
      dayEnd: "Informe um dia de 1 a 31.",
    });
    expect(validateReminderForm({ ...base, startMonth: "10/2026" }, today).valid).toBe(false);
    expect(validateReminderForm({ ...base, intervalMonths: "5" }, today).valid).toBe(false);
  });

  it("lembrete único não aceita data passada, exceto ao editar", () => {
    const once = { ...base, kind: "once" as const, dueDate: "2026-10-01" };
    expect(validateReminderForm(once, today).valid).toBe(false);
    expect(validateReminderForm(once, today, true).valid).toBe(true);
    expect(validateReminderForm({ ...once, dueDate: "2026-02-30" }, today).valid).toBe(false);
    expect(validateReminderForm({ ...once, dueDate: today }, today).valid).toBe(true);
  });

  it("semanal guarda o dia da semana", () => {
    const result = validateReminderForm({ ...base, kind: "weekly", weekday: "5" }, today);
    expect(result.valid && result.value.schedule).toEqual({ kind: "weekly", weekday: 5 });
  });

  it("o formulário de edição reproduz o lembrete", () => {
    const values = reminderToForm({ ...presenca, notes: "Bolsa Família" }, today);
    expect(values).toMatchObject({
      kind: "monthly",
      intervalMonths: "2",
      startMonth: "2026-10",
      dayStart: "1",
      dayEnd: "10",
      notes: "Bolsa Família",
    });
    expect(validateReminderForm(values, today).valid).toBe(true);
  });
});
