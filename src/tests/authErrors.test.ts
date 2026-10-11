import { describe, expect, it } from "vitest";
import { loginErrorMessage, validateLogin } from "../utils/authErrors";

describe("loginErrorMessage", () => {
  it("traduz credenciais inválidas sem revelar se o e-mail existe", () => {
    expect(loginErrorMessage({ message: "Invalid login credentials" })).toBe("E-mail ou senha incorretos.");
  });

  it("avisa sobre acesso desativado", () => {
    expect(loginErrorMessage({ message: "User is banned" })).toContain("desativado");
  });

  it("avisa sobre excesso de tentativas", () => {
    expect(loginErrorMessage({ message: "x", status: 429 })).toContain("Muitas tentativas");
  });

  it("usa mensagem genérica para erros desconhecidos", () => {
    expect(loginErrorMessage({ message: "boom" })).toBe("Não foi possível entrar. Tente novamente.");
  });
});

describe("validateLogin", () => {
  it("exige e-mail válido e senha", () => {
    expect(validateLogin("", "x")).toBe("Informe o e-mail.");
    expect(validateLogin("abc", "x")).toBe("Informe um e-mail válido.");
    expect(validateLogin("a@b.com", "")).toBe("Informe a senha.");
    expect(validateLogin(" a@b.com ", "x")).toBeNull();
  });
});
