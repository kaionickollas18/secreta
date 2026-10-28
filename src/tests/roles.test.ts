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
  isStaffRole,
  ROLE_LABELS,
  roleLabel,
} from "../utils/roles";

describe("permissões por papel", () => {
  it("só o Master gerencia escolas", () => {
    expect(canManageSchools("master")).toBe(true);
    expect(canManageSchools("secretary")).toBe(false);
    expect(canManageSchools("assistant")).toBe(false);
  });

  it("só o Secretário cadastra assistentes", () => {
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

  it("assistente com acesso especial age como secretário, menos na gestão da equipe", () => {
    const elevated = { role: "assistant", elevated: true } as const;
    const role = effectiveRole(elevated);
    expect(role).toBe("secretary");
    for (const check of [canManageTasks, canApproveCompletion, canConfigureDashboard, canManageReminders, canManageHolidays, canModerateMessages]) {
      expect(check(role)).toBe(true);
    }
    // A gestão da equipe olha o papel real, não o efetivo.
    expect(canManageAssistants(elevated.role)).toBe(false);
    expect(roleLabel(elevated)).toBe("Assistente Administrativo · Acesso de secretário");
  });

  it("o acesso especial só existe para assistente", () => {
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

  it("o professor é da escola, mas não da secretaria, e não tem permissões de gestão", () => {
    expect(isSchoolRole("teacher")).toBe(true);
    expect(isStaffRole("teacher")).toBe(false);
    expect(isStaffRole("assistant")).toBe(true);
    expect(ROLE_LABELS.teacher).toBe("Professor(a)");
    expect(roleLabel({ role: "teacher", elevated: true })).toBe("Professor(a)");
    expect(effectiveRole({ role: "teacher", elevated: true })).toBe("teacher");
    for (const can of [canManageTasks, canApproveCompletion, canConfigureDashboard, canManageReminders, canModerateMessages, canManageAssistants]) {
      expect(can("teacher")).toBe(false);
    }
  });
});
