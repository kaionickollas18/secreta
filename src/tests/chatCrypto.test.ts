// @vitest-environment node
// A Web Crypto completa existe no Node; o jsdom dos outros testes não a oferece.
import { describe, expect, it } from "vitest";
import {
  conversationKey,
  decryptBytes,
  decryptText,
  encryptBytes,
  encryptText,
  fromBase64,
  generateKeyPair,
  importPrivateKey,
  isPublicJwk,
  toBase64,
  unwrapPrivateKey,
  wrapPrivateKey,
} from "../utils/chatCrypto";

describe("criptografia das conversas diretas", () => {
  it("os dois lados chegam à mesma chave e leem a mensagem um do outro", async () => {
    const ana = await generateKeyPair();
    const beto = await generateKeyPair();
    const anaSide = await conversationKey(await importPrivateKey(ana.privateBytes), beto.publicKey);
    const betoSide = await conversationKey(await importPrivateKey(beto.privateBytes), ana.publicKey);

    const sealed = await encryptText(anaSide, "Reunião às 14h, ação da direção 😀");
    expect(sealed.ciphertext).not.toContain("Reunião");
    expect(await decryptText(betoSide, sealed.iv, sealed.ciphertext)).toBe("Reunião às 14h, ação da direção 😀");
    // A mesma mensagem embaralhada duas vezes nunca dá o mesmo resultado.
    expect((await encryptText(anaSide, "oi")).ciphertext).not.toBe((await encryptText(anaSide, "oi")).ciphertext);
  });

  it("uma terceira pessoa, ou um texto adulterado, não abre a mensagem", async () => {
    const [ana, beto, rita] = await Promise.all([generateKeyPair(), generateKeyPair(), generateKeyPair()]);
    const anaSide = await conversationKey(await importPrivateKey(ana.privateBytes), beto.publicKey);
    const ritaSide = await conversationKey(await importPrivateKey(rita.privateBytes), ana.publicKey);
    const sealed = await encryptText(anaSide, "segredo");

    await expect(decryptText(ritaSide, sealed.iv, sealed.ciphertext)).rejects.toThrow();
    const tampered = fromBase64(sealed.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 1;
    await expect(decryptText(anaSide, sealed.iv, toBase64(tampered))).rejects.toThrow();
  });

  it("a chave privada só volta com a senha certa", async () => {
    const pair = await generateKeyPair();
    const wrapped = await wrapPrivateKey(pair.privateBytes, "senha-da-ana");
    expect(wrapped.wrapped).not.toBe(toBase64(pair.privateBytes));

    expect(toBase64(await unwrapPrivateKey(wrapped, "senha-da-ana"))).toBe(toBase64(pair.privateBytes));
    await expect(unwrapPrivateKey(wrapped, "outra-senha")).rejects.toThrow();
    // Trocar a senha: a mesma chave, embaralhada de novo.
    const rewrapped = await wrapPrivateKey(await unwrapPrivateKey(wrapped, "senha-da-ana"), "senha-nova");
    expect(toBase64(await unwrapPrivateKey(rewrapped, "senha-nova"))).toBe(toBase64(pair.privateBytes));
  }, 30_000);

  it("a chave guardada no aparelho não pode ser copiada", async () => {
    const pair = await generateKeyPair();
    const key = await importPrivateKey(pair.privateBytes);
    expect(key.extractable).toBe(false);
    await expect(globalThis.crypto.subtle.exportKey("pkcs8", key)).rejects.toThrow();
  });

  it("confere o formato da chave pública vinda do banco", async () => {
    expect(isPublicJwk((await generateKeyPair()).publicKey)).toBe(true);
    expect(isPublicJwk({ kty: "EC", crv: "P-384", x: "a", y: "b" })).toBe(false);
    expect(isPublicJwk({ kty: "RSA", n: "a", e: "b" })).toBe(false);
    expect(isPublicJwk(null)).toBe(false);
    expect(toBase64(fromBase64("AAEC/w=="))).toBe("AAEC/w==");
  });

  it("o anexo é embaralhado com a chave da conversa e só o colega o abre", async () => {
    const ana = await generateKeyPair();
    const beto = await generateKeyPair();
    const caio = await generateKeyPair();
    const anaSide = await conversationKey(await importPrivateKey(ana.privateBytes), beto.publicKey);
    const betoSide = await conversationKey(await importPrivateKey(beto.privateBytes), ana.publicKey);
    const outsider = await conversationKey(await importPrivateKey(caio.privateBytes), ana.publicKey);

    const original = new TextEncoder().encode("%PDF-1.7 conteúdo do memorando").buffer;
    const sealed = await encryptBytes(anaSide, original);
    expect(new TextDecoder().decode(sealed.data)).not.toContain("memorando");
    const opened = await decryptBytes(betoSide, sealed.iv, sealed.data);
    expect(new TextDecoder().decode(opened)).toBe("%PDF-1.7 conteúdo do memorando");
    await expect(decryptBytes(outsider, sealed.iv, sealed.data)).rejects.toThrow();
  });
});
