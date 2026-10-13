import { describe, expect, it } from "vitest";
import type { Holiday } from "../types/calendar";
import type { Reminder } from "../types/reminder";
import { buildCalendar, longDate, monthGrid, monthLabel, shiftMonth } from "../utils/calendar";
import {
  easterSunday,
  holidayFromRow,
  holidayToForm,
  nationalHolidays,
  validateHolidayForm,
} from "../utils/holidays";
import { myDueTasks, noticeSlot, reminderNotices, summarizeTitles } from "../utils/notices";
import { occurrencesBetween } from "../utils/reminders";
import { makeTask } from "./helpers";

describe("feriados nacionais", () => {
  it("calcula a Páscoa", () => {
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("traz os fixos e os de data móvel, em ordem", () => {
    const list = nationalHolidays(2026);
    const on = (date: string) => list.filter((h) => h.start === date).map((h) => `${h.name}|${h.source}`);
    expect(on("2026-04-03")).toEqual(["Sexta-feira Santa|national"]);
    expect(on("2026-02-16")).toEqual(["Carnaval|optional"]);
    expect(on("2026-02-17")).toEqual(["Carnaval|optional"]);
    expect(on("2026-06-04")).toEqual(["Corpus Christi|optional"]);
    expect(on("2026-10-12")).toEqual(["Nossa Senhora Aparecida|national"]);
    expect(on("2026-11-20")).toEqual(["Dia da Consciência Negra|national"]);
    expect(list.map((h) => h.start)).toEqual([...list.map((h) => h.start)].sort());
    expect(list).toHaveLength(13);
  });
});

describe("feriados da escola", () => {
  it("valida nome, datas e duração", () => {
    expect(validateHolidayForm({ name: " Aniversário da cidade ", start: "2026-08-10", end: "" })).toEqual({
      valid: true,
      value: { name: "Aniversário da cidade", start: "2026-08-10", end: "2026-08-10" },
    });
    expect(validateHolidayForm({ name: "Recesso", start: "2026-07-13", end: "2026-07-24" }).valid).toBe(true);

    const errorsOf = (values: Parameters<typeof validateHolidayForm>[0]) => {
      const result = validateHolidayForm(values);
      return result.valid ? {} : result.errors;
    };
    expect(errorsOf({ name: "", start: "2026-02-30", end: "" })).toMatchObject({
      name: expect.any(String),
      start: expect.any(String),
    });
    expect(errorsOf({ name: "Recesso", start: "2026-07-13", end: "2026-07-01" }).end).toContain("antes");
    expect(errorsOf({ name: "Recesso", start: "2026-01-01", end: "2026-12-31" }).end).toContain("93 dias");
  });

  it("converte a linha do banco e ignora as inválidas", () => {
    const row = { id: "h1", name: "Recesso", starts_on: "2026-07-13", ends_on: "2026-07-24" };
    const holiday = holidayFromRow(row);
    expect(holiday).toEqual({ id: "h1", name: "Recesso", start: "2026-07-13", end: "2026-07-24", source: "school" });
    expect(holiday && holidayToForm(holiday).end).toBe("2026-07-24");
    expect(holidayFromRow({ ...row, ends_on: "2026-07-01" })).toBeNull();
    expect(holidayFromRow({ ...row, starts_on: null })).toBeNull();
    expect(holidayFromRow({ ...row, name: 3 })).toBeNull();
  });
});

describe("grade do mês", () => {
  it("vai de domingo a sábado e completa com os meses vizinhos", () => {
    const weeks = monthGrid("2026-10");
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(weeks[4]?.[6]).toBe("2026-10-31");
    // Fevereiro de 2026 começa no domingo e cabe em 4 semanas; agosto precisa de 6.
    expect(monthGrid("2026-02")).toHaveLength(4);
    expect(monthGrid("2026-08")).toHaveLength(6);
  });

  it("troca de mês atravessando o ano e escreve as datas por extenso", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-03")).toBe("março de 2026");
    expect(longDate("2026-10-05")).toBe("5 de outubro de 2026");
  });
});

describe("lembretes no calendário", () => {
  it("lista os ciclos que tocam o intervalo", () => {
    expect(
      occurrencesBetween({ kind: "weekly", weekday: 1 }, "2026-10-01", "2026-10-14").map((o) => o.start),
    ).toEqual(["2026-10-05", "2026-10-12"]);

    const bimonthly = { kind: "monthly", intervalMonths: 2, startMonth: "2026-09", dayStart: 15, dayEnd: 20 } as const;
    expect(occurrencesBetween(bimonthly, "2026-10-01", "2026-12-31")).toEqual([
      { periodKey: "2026-11", start: "2026-11-15", end: "2026-11-20" },
    ]);
    // Um ciclo que só encosta no intervalo também conta; antes do início não há ciclos.
    expect(occurrencesBetween(bimonthly, "2026-09-20", "2026-09-30")).toHaveLength(1);
    expect(occurrencesBetween(bimonthly, "2026-01-01", "2026-08-31")).toEqual([]);

    const once = { kind: "once", dueDate: "2026-10-13" } as const;
    expect(occurrencesBetween(once, "2026-10-01", "2026-10-31")).toHaveLength(1);
    expect(occurrencesBetween(once, "2026-11-01", "2026-11-30")).toEqual([]);
  });

  it("junta feriados, tarefas e lembretes por dia", () => {
    const recess: Holiday = { id: "h1", name: "Recesso", start: "2026-10-12", end: "2026-10-14", source: "school" };
    const reminder: Reminder = {
      id: "r1",
      title: "Memorando",
      schedule: { kind: "monthly", intervalMonths: 1, startMonth: "2026-01", dayStart: 10, dayEnd: 12 },
      createdOn: "2026-01-01",
    };
    const late: Reminder = {
      id: "r2",
      title: "Criado depois",
      schedule: { kind: "once", dueDate: "2026-10-05" },
      createdOn: "2026-10-09",
    };
    const task = makeTask({ title: "Emitir históricos", dueDate: "2026-10-13" });
    const days = buildCalendar("2026-10-01", "2026-10-31", {
      tasks: [task, makeTask(), makeTask({ dueDate: "2026-11-02" })],
      reminders: [reminder, late],
      doneKeys: new Set(["r1|2026-10"]),
      holidays: [recess, ...nationalHolidays(2026)],
    });

    expect(days.get("2026-10-13")).toEqual({ holidays: [recess], tasks: [task], reminders: [] });
    expect(days.get("2026-10-12")?.holidays.map((h) => h.name)).toEqual(["Recesso", "Nossa Senhora Aparecida"]);
    expect(days.get("2026-10-11")?.reminders).toEqual([
      { reminder, occurrence: { periodKey: "2026-10", start: "2026-10-10", end: "2026-10-12" }, done: true },
    ]);
    // Ciclo anterior à criação do lembrete não aparece; dia sem nada não entra no mapa.
    expect(days.has("2026-10-05")).toBe(false);
    expect(days.has("2026-11-02")).toBe(false);
  });
});

describe("avisos do quadro", () => {
  it("os lembretes aparecem às 8h e voltam às 12h", () => {
    expect(noticeSlot(new Date(2026, 9, 13, 7, 59))).toBeNull();
    expect(noticeSlot(new Date(2026, 9, 13, 8, 0))).toEqual({ hour: 8, key: "2026-10-13|8" });
    expect(noticeSlot(new Date(2026, 9, 13, 11, 59))?.hour).toBe(8);
    expect(noticeSlot(new Date(2026, 9, 13, 12, 0))).toEqual({ hour: 12, key: "2026-10-13|12" });
    expect(noticeSlot(new Date(2026, 9, 14, 9, 0))?.key).toBe("2026-10-14|8");
  });

  it("só entram lembretes que pedem ação, o atrasado primeiro", () => {
    const make = (id: string, dueDate: string): Reminder => ({
      id,
      title: id,
      schedule: { kind: "once", dueDate },
      createdOn: "2026-01-01",
    });
    const reminders = [make("hoje", "2026-10-13"), make("feito", "2026-10-13"), make("ontem", "2026-10-12"), make("depois", "2026-10-20")];
    const notices = reminderNotices(reminders, new Set(["feito|once"]), "2026-10-13");
    expect(notices.map((n) => n.reminder.id)).toEqual(["ontem", "hoje"]);
    expect(summarizeTitles(["A", "B", "C", "D"])).toBe("A, B e mais 2");
    expect(summarizeTitles(["A"])).toBe("A");
  });

  it("as tarefas avisam só o responsável, quando vencem hoje ou atrasaram", () => {
    const today = makeTask({ id: "hoje", assignees: ["ana"], dueDate: "2026-10-13" });
    const overdue = makeTask({ id: "atrasada", assignees: ["beto", "ana"], dueDate: "2026-10-01" });
    const tasks = [
      today,
      overdue,
      makeTask({ id: "de-outro", assignees: ["beto"], dueDate: "2026-10-13" }),
      makeTask({ id: "futura", assignees: ["ana"], dueDate: "2026-10-20" }),
      makeTask({ id: "concluida", assignees: ["ana"], dueDate: "2026-10-01", status: "done" }),
      makeTask({ id: "sem-prazo", assignees: ["ana"] }),
    ];
    expect(myDueTasks(tasks, "ana", "2026-10-13")).toEqual({ dueToday: [today], overdue: [overdue] });
    expect(myDueTasks(tasks, "sec", "2026-10-13")).toEqual({ dueToday: [], overdue: [] });
  });
});
