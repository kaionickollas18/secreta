import { afterEach, describe, expect, it } from "vitest";
import {
  THEME_PREFERENCE_KEY,
  applyTheme,
  currentTheme,
  parseTheme,
  readThemePreference,
  serializeTheme,
  writeThemePreference,
} from "../utils/themePreference";

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("preferência de tema", () => {
  it("lê só os valores conhecidos; o resto segue o sistema", () => {
    expect(parseTheme("claro")).toBe("light");
    expect(parseTheme("escuro")).toBe("dark");
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme("dark")).toBeNull();
  });

  it("grava em português, os mesmos valores que o script do <head> entende", () => {
    expect(serializeTheme("dark")).toBe("escuro");
    expect(serializeTheme("light")).toBe("claro");
    writeThemePreference("dark");
    expect(window.localStorage.getItem(THEME_PREFERENCE_KEY)).toBe("escuro");
    expect(readThemePreference()).toBe("dark");
  });

  it("a escolha gravada vale sobre o tema do sistema", () => {
    writeThemePreference("dark");
    expect(currentTheme()).toBe("dark");
    writeThemePreference("light");
    expect(currentTheme()).toBe("light");
  });

  it("aplica o tema no <html>", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
