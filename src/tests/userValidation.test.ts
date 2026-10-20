import { describe, expect, it } from "vitest";
import type { MemberFormValues } from "../types/directory";
import { validateMemberForm } from "../utils/userValidation";

const valid: MemberFormValues = {
  schoolName: "Escola Modelo",
  fullName: "Ana Souza",
  email: "ana@escola.com",
  password: "senha-forte-1",
  active: true,
  role: "assistant",
  lastName: "Souza",
  nickname: "",
  birthDate: "",
  removePhoto: false,
};

describe("validateMemberForm", () => {
  it("aceita um cadastro completo", () => {
    expect(validateMemberForm(valid, { creating: true, withSchoolName: true }).valid).toBe(true);
  });

  it("no cadastro exige nome, e-mail válido e senha de 8+ caracteres", () => {
    const { errors } = validateMemberForm(
      { ...valid, fullName: " ", email: "ana@", password: "curta" },
      { creating: true, withSchoolName: false },
    );
    expect(errors.fullName).toBeDefined();
    expect(errors.email).toBe("Informe um e-mail válido.");
    expect(errors.password).toContain("8");
  });

  it("exige o nome da escola só quando o campo existe", () => {
    const values = { ...valid, schoolName: "" };
    expect(validateMemberForm(values, { creating: true, withSchoolName: true }).errors.schoolName).toBeDefined();
    expect(validateMemberForm(values, { creating: true, withSchoolName: false }).valid).toBe(true);
  });

  it("na edição, senha em branco mantém a atual e o e-mail não é validado", () => {
    const result = validateMemberForm(
      { ...valid, email: "", password: "" },
      { creating: false, withSchoolName: false },
    );
    expect(result.valid).toBe(true);
  });

  it("na edição, uma senha nova ainda precisa ter 8+ caracteres", () => {
    const result = validateMemberForm({ ...valid, password: "123" }, { creating: false, withSchoolName: false });
    expect(result.errors.password).toBeDefined();
  });
});
