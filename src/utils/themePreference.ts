/** Tema da interface. */
export type Theme = "light" | "dark";

/**
 * Chave da preferência de tema neste navegador. O script no `<head>` de cada `.html` lê a mesma
 * chave e os mesmos valores, para aplicar o tema antes do primeiro desenho.
 */
export const THEME_PREFERENCE_KEY = "secreta:tema";

const MEDIA_DARK = "(prefers-color-scheme: dark)";

/** Sem escolha gravada (`null`), o tema segue o do sistema. */
export function parseTheme(raw: string | null): Theme | null {
  if (raw === "claro") return "light";
  if (raw === "escuro") return "dark";
  return null;
}

export function serializeTheme(theme: Theme): string {
  return theme === "dark" ? "escuro" : "claro";
}

export function readThemePreference(): Theme | null {
  try {
    return parseTheme(window.localStorage.getItem(THEME_PREFERENCE_KEY));
  } catch {
    return null;
  }
}

export function writeThemePreference(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_PREFERENCE_KEY, serializeTheme(theme));
  } catch {
    // sem armazenamento local: a escolha vale só até trocar de página
  }
}

/** Tema do sistema operacional (claro quando o navegador não informa). */
export function systemTheme(): Theme {
  return typeof window.matchMedia === "function" && window.matchMedia(MEDIA_DARK).matches ? "dark" : "light";
}

/** Tema em uso: o escolhido pela pessoa ou, sem escolha, o do sistema. */
export function currentTheme(): Theme {
  return readThemePreference() ?? systemTheme();
}

/** Marca o tema no `<html>`; as cores de `src/index.css` mudam por ele. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}

/** Avisa quando o tema do sistema muda. Devolve a função que para de observar. */
export function watchSystemTheme(onChange: (theme: Theme) => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(MEDIA_DARK);
  const handle = (event: MediaQueryListEvent) => onChange(event.matches ? "dark" : "light");
  media.addEventListener("change", handle);
  return () => media.removeEventListener("change", handle);
}
