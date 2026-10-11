import { describe, expect, it } from "vitest";
import {
  canApproveCompletion,
  canConfigureDashboard,
  canManageAssistants,
  canManageSchools,
  canManageTasks,
  isSchoolRole,
} from "../utils/roles";

describe("permissões por papel", () => {
  it("só o Master gerencia escolas", () => {
    expect(canManageSchools("master")).toBe(true);
    expect(canManageSchools("secretary")).toBe(false);
    expect(canManageSchools("assistant")).toBe(false);
  });

  it("só o Secretário cadastra auxiliares", () => {
    expect(canManageAssistants("secretary")).toBe(true);
    expect(canManageAssistants("master")).toBe(false);
    expect(canManageAssistants("assistant")).toBe(false);
  });

  it("só o Secretário cria tarefas, aprova conclusão e configura o dashboard", () => {
    for (const check of [canManageTasks, canApproveCompletion, canConfigureDashboard]) {
      expect(check("secretary")).toBe(true);
      expect(check("assistant")).toBe(false);
      expect(check("master")).toBe(false);
    }
  });

  it("o Master não usa o quadro da escola", () => {
    expect(isSchoolRole("master")).toBe(false);
    expect(isSchoolRole("secretary")).toBe(true);
    expect(isSchoolRole("assistant")).toBe(true);
  });
});
