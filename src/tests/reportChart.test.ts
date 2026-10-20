import { describe, expect, it } from "vitest";
import type { MonthStat } from "../types/attendance";
import {
  CHART_BOX,
  monthHighlights,
  monthShort,
  monthTitle,
  periodText,
  presenceChart,
  spansYears,
} from "../utils/reportChart";

const month = (id: string, presenceRate: number, risk: MonthStat["risk"] = "ok"): MonthStat => ({
  month: id,
  label: id,
  schoolDays: 20,
  absences: Math.round((1 - presenceRate) * 20),
  presenceRate,
  risk,
  dates: [],
});

describe("gráfico do documento do aluno", () => {
  const months = [month("2026-08", 0.95), month("2026-09", 0.6, "critical"), month("2026-10", 1)];

  it("distribui os meses na largura e põe 100% no topo", () => {
    const chart = presenceChart(months);
    const xs = chart.points.map((p) => p.x);
    expect(xs[0]).toBe(CHART_BOX.left);
    expect(xs[2]).toBe(CHART_BOX.width - CHART_BOX.right);
    expect(chart.points[2]?.y).toBe(CHART_BOX.top);
    expect(chart.points.map((p) => p.label)).toEqual(["ago", "set", "out"]);
    expect(chart.line.startsWith(`M${CHART_BOX.left} `)).toBe(true);
    expect(chart.area.endsWith("Z")).toBe(true);
  });

  it("a escala desce abaixo do pior mês e mantém as linhas de atenção e crítico", () => {
    const chart = presenceChart(months);
    // Pior mês 60% -> escala a partir de 50%.
    expect(chart.ticks.map((t) => t.label)).toEqual(["100%", "90%", "80%", "70%", "60%", "50%"]);
    expect(chart.ticks[chart.ticks.length - 1]?.y).toBe(chart.baseline);
    expect(chart.limits.map((l) => l.label)).toEqual(["Atenção", "Crítico"]);
    // Mesmo com todos os meses perfeitos, a escala mostra as duas linhas.
    expect(presenceChart([month("2026-10", 1)]).limits).toHaveLength(2);
  });

  it("com um mês só, o ponto fica no meio e não há linha", () => {
    const chart = presenceChart([month("2026-10", 0.9)]);
    expect(chart.points[0]?.x).toBe(CHART_BOX.left + (CHART_BOX.width - CHART_BOX.left - CHART_BOX.right) / 2);
    expect(chart.line).toMatch(/^M[\d.]+ [\d.]+$/);
  });

  it("escala longa usa grade de 20 em 20", () => {
    expect(presenceChart([month("2026-10", 0.2)]).ticks.map((t) => t.label)).toEqual(["100%", "80%", "60%", "40%", "20%"]);
  });
});

describe("textos do documento do aluno", () => {
  it("nomes dos meses e período, com o ano quando passa de um ano para outro", () => {
    expect(monthShort("2026-02")).toBe("fev");
    expect(monthShort("2025-11", true)).toBe("nov/25");
    expect(monthTitle("2026-03")).toBe("Março");
    expect(monthTitle("2025-12", true)).toBe("Dezembro/2025");
    expect(spansYears([{ month: "2025-12" }, { month: "2026-02" }])).toBe(true);
    expect(periodText([{ month: "2026-02" }, { month: "2026-10" }])).toBe("fevereiro a outubro de 2026");
    expect(periodText([{ month: "2025-11" }, { month: "2026-03" }])).toBe("novembro de 2025 a março de 2026");
    expect(periodText([{ month: "2026-06" }])).toBe("junho de 2026");
    expect(periodText([])).toBe("");
  });

  it("destaca o melhor e o pior mês e conta os meses regulares", () => {
    const h = monthHighlights([month("2026-08", 0.9), month("2026-09", 0.7, "critical"), month("2026-10", 1)]);
    expect(h.best?.month).toBe("2026-10");
    expect(h.worst?.month).toBe("2026-09");
    expect([h.regular, h.total]).toEqual([2, 3]);
    // Com um mês só, não há "pior mês" separado do melhor.
    expect(monthHighlights([month("2026-10", 1)]).worst).toBeUndefined();
  });
});
