import { describe, expect, it } from "vitest";
import type { ClassData } from "../types/attendance";
import {
  buildInsights,
  dailySeries,
  riskOf,
  selectClasses,
  summarizeClasses,
  summarizeStudents,
  weekdayStats,
} from "../utils/attendance";

// 2026-06-01 é segunda-feira.
const classes: ClassData[] = [
  {
    name: "5 ano A",
    records: [
      { date: "2026-06-01", absent: ["Ana", "Bia"] },
      { date: "2026-06-02", absent: ["Ana"] },
      { date: "2026-06-03", absent: [] },
      { date: "2026-06-04", absent: ["Ana", "Caio"] },
    ],
  },
  {
    name: "6 ano A",
    records: [
      { date: "2026-06-01", absent: [] },
      { date: "2026-06-02", absent: ["Davi"] },
    ],
  },
];

describe("riskOf", () => {
  it("classifica pelo percentual de faltas", () => {
    expect(riskOf(0.26)).toBe("critical");
    expect(riskOf(0.25)).toBe("warning");
    expect(riskOf(0.15)).toBe("warning");
    expect(riskOf(0.1)).toBe("ok");
  });
});

describe("summarizeStudents", () => {
  it("conta faltas, percentual e sequência atual", () => {
    const students = summarizeStudents(classes);
    const ana = students.find((s) => s.name === "Ana");
    expect(students[0]?.name).toBe("Ana");
    expect(ana).toMatchObject({ absences: 3, schoolDays: 4, rate: 0.75, streak: 1, risk: "critical" });
    expect(students.find((s) => s.name === "Davi")).toMatchObject({ streak: 1, rate: 0.5 });
    expect(students.find((s) => s.name === "Bia")?.streak).toBe(0);
  });
});

describe("summarizeClasses", () => {
  it("resume faltas por turma", () => {
    const [a, b] = summarizeClasses(classes);
    expect(a).toMatchObject({ days: 4, absences: 5, avgPerDay: 1.25, studentsWithAbsence: 3, critical: 1 });
    expect(a?.topStudent).toEqual({ name: "Ana", absences: 3 });
    expect(b).toMatchObject({ days: 2, absences: 1 });
  });

  it("filtra turmas pelo nome", () => {
    expect(selectClasses(classes, "all")).toHaveLength(2);
    expect(selectClasses(classes, "6 ano A").map((c) => c.name)).toEqual(["6 ano A"]);
  });
});

describe("séries", () => {
  it("soma faltas por data e calcula média móvel", () => {
    const series = dailySeries(classes);
    expect(series.map((p) => p.absences)).toEqual([2, 2, 0, 2]);
    expect(series[3]?.average).toBe(1.5);
  });

  it("calcula a média de faltas por dia da semana", () => {
    const stats = weekdayStats(dailySeries(classes));
    expect(stats.find((s) => s.weekday === 1)?.avgAbsences).toBe(2); // segunda
    expect(stats.find((s) => s.weekday === 5)?.days).toBe(0); // sexta sem dados
  });
});

describe("buildInsights", () => {
  it("gera destaques e fica vazio sem dados", () => {
    expect(buildInsights(classes).join(" ")).toContain("5 ano A");
    expect(buildInsights([])).toEqual([]);
  });
});
