import { describe, expect, it } from "vitest";
import type { TaskFormValues } from "../types/task";
import { isValidISODate } from "../utils/date";
import { sanitizeText, validateTaskForm } from "../utils/validation";

const base: TaskFormValues = {
  title: "Escrever relatório",
  description: "",
  status: "todo",
  priority: "medium",
  assignees: [],
  dueDate: "",
};

describe("validateTaskForm", () => {
  it("aceita dados válidos e normaliza campos vazios para undefined", () => {
    const result = validateTaskForm({ ...base, title: "  Escrever relatório  " });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.title).toBe("Escrever relatório");
      expect(result.value.description).toBeUndefined();
      expect(result.value.dueDate).toBeUndefined();
    }
  });

  it("rejeita título vazio ou só com espaços", () => {
    const result = validateTaskForm({ ...base, title: "   " });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.title).toBeDefined();
  });

  it("rejeita título e descrição acima do limite", () => {
    const result = validateTaskForm({
      ...base,
      title: "a".repeat(121),
      description: "b".repeat(1001),
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.title).toBeDefined();
      expect(result.errors.description).toBeDefined();
    }
  });

  it("rejeita data inexistente", () => {
    const result = validateTaskForm({ ...base, dueDate: "2026-02-31" });
    expect(result.valid).toBe(false);
  });

  it("aceita data válida", () => {
    const result = validateTaskForm({ ...base, dueDate: "2026-12-31" });
    expect(result.valid).toBe(true);
  });
});

describe("sanitizeText", () => {
  it("remove caracteres de controle e preserva quebras de linha", () => {
    expect(sanitizeText("a\u0000b\nc\u0007")).toBe("ab\nc");
  });
});

describe("isValidISODate", () => {
  it("valida formato e calendário", () => {
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("2027-02-29")).toBe(false);
    expect(isValidISODate("29/02/2028")).toBe(false);
  });
});
