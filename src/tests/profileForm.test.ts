import { describe, expect, it } from "vitest";
import {
  centerSquare,
  LAST_NAME_MAX,
  PHOTO_MAX_BYTES,
  validateLastName,
  validatePasswordForm,
  validatePhotoFile,
} from "../utils/profileForm";

describe("perfil próprio", () => {
  it("sobrenome: apara, junta espaços e limita o tamanho", () => {
    expect(validateLastName("  da   Cruz  ")).toEqual({ valid: true, value: "da Cruz" });
    expect(validateLastName("   ").valid).toBe(false);
    expect(validateLastName("a".repeat(LAST_NAME_MAX + 1)).valid).toBe(false);
    expect(validateLastName("a".repeat(LAST_NAME_MAX)).valid).toBe(true);
  });

  it("senha: exige a atual, tamanho mínimo, diferença e confirmação igual", () => {
    expect(validatePasswordForm({ current: "antiga-123", next: "nova-senha-1", confirm: "nova-senha-1" }).valid).toBe(
      true,
    );
    expect(validatePasswordForm({ current: "", next: "nova-senha-1", confirm: "nova-senha-1" }).errors.current).toBeDefined();
    expect(validatePasswordForm({ current: "antiga-123", next: "curta", confirm: "curta" }).errors.next).toContain("8");
    expect(
      validatePasswordForm({ current: "mesma-senha", next: "mesma-senha", confirm: "mesma-senha" }).errors.next,
    ).toBe("A nova senha precisa ser diferente da atual.");
    expect(
      validatePasswordForm({ current: "antiga-123", next: "nova-senha-1", confirm: "nova-senha-2" }).errors.confirm,
    ).toBe("As duas senhas novas não são iguais.");
  });

  it("foto: aceita JPG, PNG e WebP dentro do limite", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validatePhotoFile({ type: "image/webp", size: PHOTO_MAX_BYTES })).toBeNull();
    expect(validatePhotoFile({ type: "image/heic", size: 1000 })).toContain("JPG");
    expect(validatePhotoFile({ type: "application/pdf", size: 1000 })).toContain("JPG");
    expect(validatePhotoFile({ type: "image/png", size: PHOTO_MAX_BYTES + 1 })).toContain("10 MB");
  });

  it("recorte: o maior quadrado centralizado", () => {
    expect(centerSquare(800, 600)).toEqual({ x: 100, y: 0, side: 600 });
    expect(centerSquare(600, 900)).toEqual({ x: 0, y: 150, side: 600 });
    expect(centerSquare(500, 500)).toEqual({ x: 0, y: 0, side: 500 });
  });
});
