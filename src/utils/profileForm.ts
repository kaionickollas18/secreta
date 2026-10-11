import { PASSWORD_MAX, PASSWORD_MIN } from "./userValidation";
import { sanitizeText } from "./validation";

export const LAST_NAME_MAX = 60;
/** Lado, em pixels, da foto de perfil guardada (quadrada). */
export const AVATAR_PIXELS = 256;
/** Maior arquivo aceito para escolher como foto (ele é reduzido antes do envio). */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Sobrenome pronto para salvar, ou a mensagem de erro. */
export function validateLastName(
  value: string,
): { valid: true; value: string } | { valid: false; error: string } {
  const lastName = sanitizeText(value).replace(/\s+/g, " ");
  if (lastName.length === 0) return { valid: false, error: "Informe o sobrenome." };
  if (lastName.length > LAST_NAME_MAX)
    return { valid: false, error: `Use no máximo ${LAST_NAME_MAX} caracteres.` };
  return { valid: true, value: lastName };
}

export interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

export type PasswordErrors = Partial<Record<keyof PasswordForm, string>>;

export function validatePasswordForm(form: PasswordForm): { valid: boolean; errors: PasswordErrors } {
  const errors: PasswordErrors = {};
  if (!form.current) errors.current = "Informe a senha atual.";
  if (form.next.length < PASSWORD_MIN || form.next.length > PASSWORD_MAX)
    errors.next = `A nova senha deve ter de ${PASSWORD_MIN} a ${PASSWORD_MAX} caracteres.`;
  else if (form.next === form.current) errors.next = "A nova senha precisa ser diferente da atual.";
  if (form.confirm !== form.next) errors.confirm = "As duas senhas novas não são iguais.";
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Confere o arquivo escolhido antes de processar. Devolve a mensagem de erro, ou `null`. */
export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type))
    return "Use uma foto em JPG, PNG ou WebP.";
  if (file.size > PHOTO_MAX_BYTES) return "A foto é grande demais (máximo de 10 MB).";
  return null;
}

/** Maior quadrado centralizado que cabe na imagem: o recorte da foto de perfil. */
export function centerSquare(width: number, height: number): { x: number; y: number; side: number } {
  const side = Math.min(width, height);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), side };
}

/**
 * Recorta a foto em quadrado, reduz para 256 px e regrava como JPEG. Além de deixar o arquivo
 * pequeno, isso descarta os metadados da câmera (como o local onde a foto foi tirada).
 */
export async function preparePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { x, y, side } = centerSquare(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_PIXELS;
    canvas.height = AVATAR_PIXELS;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas indisponível");
    context.drawImage(bitmap, x, y, side, side, 0, 0, AVATAR_PIXELS, AVATAR_PIXELS);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("falha ao gerar a imagem"))), "image/jpeg", 0.86);
    });
  } finally {
    bitmap.close();
  }
}
