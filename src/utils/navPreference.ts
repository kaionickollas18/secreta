/** Chave da preferência do menu lateral (estendido ou retraído) neste navegador. */
export const NAV_PREFERENCE_KEY = "secreta:menu";

/** O menu começa estendido; só fica retraído se a pessoa escolheu assim. */
export function parseNavCollapsed(raw: string | null): boolean {
  return raw === "retraido";
}

export function serializeNavCollapsed(collapsed: boolean): string {
  return collapsed ? "retraido" : "estendido";
}

export function readNavCollapsed(): boolean {
  try {
    return parseNavCollapsed(window.localStorage.getItem(NAV_PREFERENCE_KEY));
  } catch {
    return false;
  }
}

export function writeNavCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(NAV_PREFERENCE_KEY, serializeNavCollapsed(collapsed));
  } catch {
    // sem armazenamento local: a escolha vale só até trocar de página
  }
}
