import { describe, expect, it } from "vitest";
import {
  canApproveCompletion,
  canConfigureDashboard,
  canManageAssistants,
  canManageHolidays,
  canManageReminders,
  canManageSchools,
  canManageTasks,
  canModerateMessages,
  effectiveRole,
  isSchoolRole,
  roleLabel,
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
    for (const check of [canManageTasks, canApproveCompletion, canConfigureDashboard, canManageHolidays]) {
      expect(check("secretary")).toBe(true);
      expect(check("assistant")).toBe(false);
      expect(check("master")).toBe(false);
    }
  });

  it("auxiliar com acesso especial age como secretário, menos na gestão da equipe", () => {
    const elevated = { role: "assistant", elevated: true } as const;
    const role = effectiveRole(elevated);
    expect(role).toBe("secretary");
    for (const check of [canManageTasks, canApproveCompletion, canConfigureDashboard, canManageReminders, canManageHolidays, canModerateMessages]) {
      expect(check(role)).toBe(true);
    }
    // A gestão da equipe olha o papel real, não o efetivo.
    expect(canManageAssistants(elevated.role)).toBe(false);
    expect(roleLabel(elevated)).toBe("Auxiliar Administrativo · Acesso de secretário");
  });

  it("o acesso especial só existe para auxiliar", () => {
    expect(effectiveRole({ role: "assistant" })).toBe("assistant");
    expect(effectiveRole({ role: "assistant", elevated: false })).toBe("assistant");
    expect(effectiveRole({ role: "master", elevated: true })).toBe("master");
    expect(effectiveRole({ role: "secretary", elevated: true })).toBe("secretary");
    expect(roleLabel({ role: "secretary", elevated: true })).toBe("Secretário");
  });

  it("o Master não usa o quadro da escola", () => {
    expect(isSchoolRole("master")).toBe(false);
    expect(isSchoolRole("secretary")).toBe(true);
    expect(isSchoolRole("assistant")).toBe(true);
  });
});
