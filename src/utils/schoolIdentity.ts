import type { SchoolIdentity, SchoolIdentityErrors, SchoolIdentityForm } from "../types/school";
import { sanitizeText } from "./validation";

/** Iguais aos limites do banco (`school_settings`). */
export const IDENTITY_LIMITS = { officialName: 160, address: 200, decree: 160 } as const;
/** Lado maior, em pixels, da logo guardada. */
export const LOGO_PIXELS = 600;
export const LOGO_MAX_BYTES = 10 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const EMPTY_IDENTITY: SchoolIdentity = { officialName: "", inep: "", address: "", cep: "", decree: "" };

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Converte a linha do banco (dado externo): o que não for texto vira vazio. */
export function identityFromRow(row: Record<string, unknown> | null): SchoolIdentity {
  if (!row) return EMPTY_IDENTITY;
  const logoPath = text(row.logo_path);
  return {
    officialName: text(row.official_name),
    inep: text(row.inep),
    address: text(row.address),
    cep: text(row.cep),
    decree: text(row.decree),
    ...(logoPath ? { logoPath } : {}),
  };
}

/** "69400-616" → "69.400-616", como se escreve nos documentos. */
export function formatCep(cep: string): string {
  const match = /^(\d{2})(\d{3})-(\d{3})$/.exec(cep);
  return match ? `${match[1]}.${match[2]}-${match[3]}` : cep;
}

/** Já dá para montar o cabeçalho de um documento? (o nome é o mínimo) */
export function hasIdentity(identity: SchoolIdentity): boolean {
  return identity.officialName !== "";
}

export type IdentityValidation =
  | { valid: true; value: SchoolIdentityForm }
  | { valid: false; errors: SchoolIdentityErrors };

/** Só o nome é obrigatório. INEP e CEP aceitam pontos e traços e são guardados normalizados. */
export function validateIdentity(form: SchoolIdentityForm): IdentityValidation {
  const errors: SchoolIdentityErrors = {};
  const officialName = sanitizeText(form.officialName).replace(/\s+/g, " ");
  const address = sanitizeText(form.address).replace(/\s+/g, " ");
  const decree = sanitizeText(form.decree).replace(/\s+/g, " ");
  const inep = form.inep.replace(/\D/g, "");
  const cepDigits = form.cep.replace(/\D/g, "");

  if (officialName.length === 0) errors.officialName = "Informe o nome oficial da escola.";
  else if (officialName.length > IDENTITY_LIMITS.officialName)
    errors.officialName = `Use no máximo ${IDENTITY_LIMITS.officialName} caracteres.`;
  if (form.inep.trim() !== "" && inep.length !== 8) errors.inep = "O código INEP tem 8 dígitos.";
  if (address.length > IDENTITY_LIMITS.address) errors.address = `Use no máximo ${IDENTITY_LIMITS.address} caracteres.`;
  if (form.cep.trim() !== "" && cepDigits.length !== 8) errors.cep = "O CEP tem 8 dígitos.";
  if (decree.length > IDENTITY_LIMITS.decree) errors.decree = `Use no máximo ${IDENTITY_LIMITS.decree} caracteres.`;

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: {
      officialName,
      inep,
      address,
      cep: cepDigits ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}` : "",
      decree,
    },
  };
}

export function validateLogoFile(file: { type: string; size: number }): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return "Use uma imagem em PNG, JPG ou WebP.";
  if (file.size > LOGO_MAX_BYTES) return "A imagem é grande demais (máximo de 10 MB).";
  return null;
}

/** Tamanho final da logo: cabe em `LOGO_PIXELS`, sem deformar e sem ampliar. */
export function fitLogo(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, LOGO_PIXELS / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Reduz a logo e regrava como PNG (mantém a transparência, se houver). */
export async function prepareLogo(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = fitLogo(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas indisponível");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("falha ao gerar a imagem"))), "image/png");
    });
  } finally {
    bitmap.close();
  }
}
