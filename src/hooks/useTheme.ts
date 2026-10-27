import { useEffect, useState } from "react";
import {
  applyTheme,
  currentTheme,
  readThemePreference,
  watchSystemTheme,
  writeThemePreference,
  type Theme,
} from "../utils/themePreference";

/**
 * Tema claro ou escuro. Sem escolha gravada, acompanha o sistema (inclusive quando ele muda
 * com a página aberta); ao alternar, a escolha fica gravada e passa a valer em todas as páginas.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    if (readThemePreference()) return;
    return watchSystemTheme(setTheme);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    writeThemePreference(next);
    applyTheme(next);
    setTheme(next);
  }

  return { theme, toggle };
}
