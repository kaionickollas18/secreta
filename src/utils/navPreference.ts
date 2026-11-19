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

/** Chave da preferência do grupo "Administrativo" do menu (aberto ou fechado). */
export const NAV_GROUP_KEY = "secreta:menu-administrativo";

/** O grupo começa fechado; só fica aberto se a pessoa deixou assim. */
export function readNavGroupOpen(): boolean {
  try {
    return window.localStorage.getItem(NAV_GROUP_KEY) === "aberto";
  } catch {
    return false;
  }
}

export function writeNavGroupOpen(open: boolean): void {
  try {
    window.localStorage.setItem(NAV_GROUP_KEY, open ? "aberto" : "fechado");
  } catch {
    // sem armazenamento local: a escolha vale só até trocar de página
  }
}

export function writeNavCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(NAV_PREFERENCE_KEY, serializeNavCollapsed(collapsed));
  } catch {
    // sem armazenamento local: a escolha vale só até trocar de página
  }
}
