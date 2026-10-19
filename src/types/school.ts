/** Dados oficiais da escola, usados no cabeçalho dos documentos (`school_settings`). */
export interface SchoolIdentity {
  officialName: string;
  /** Código INEP: 8 dígitos. */
  inep: string;
  address: string;
  /** Guardado como 00000-000. */
  cep: string;
  /** Ato de criação (decreto ou lei). */
  decree: string;
  /** Caminho da logo no bucket `school-logos` (para trocar ou remover). */
  logoPath?: string;
  /** Endereço público da logo. */
  logoUrl?: string;
}

/** Valores crus do formulário (sempre strings). */
export type SchoolIdentityForm = Pick<SchoolIdentity, "officialName" | "inep" | "address" | "cep" | "decree">;

export type SchoolIdentityErrors = Partial<Record<keyof SchoolIdentityForm, string>>;
