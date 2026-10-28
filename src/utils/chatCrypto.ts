/**
 * Criptografia de ponta a ponta das conversas diretas, com a Web Crypto do navegador.
 *
 * - Cada pessoa tem um par de chaves ECDH (P-256). A pública vai para o banco.
 * - A privada só sai do navegador embaralhada (AES-GCM) com uma chave derivada da senha da
 *   pessoa (PBKDF2). Sem a senha, o que está no banco não abre.
 * - A chave de uma conversa nasce da minha privada com a pública do colega (os dois lados
 *   chegam à mesma chave) e embaralha cada mensagem com AES-GCM. Os anexos usam a mesma
 *   chave, cada um com o seu vetor.
 */

const CURVE = { name: "ECDH", namedCurve: "P-256" } as const;
/** Custo de derivar a chave a partir da senha: torna lento testar senhas em massa. */
export const PBKDF2_ITERATIONS = 300_000;

const subtle = () => globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Bytes em um buffer próprio (o tipo que a Web Crypto aceita). */
function bytes(length: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(length));
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(bytes(length));
}

export function toBase64(data: ArrayBuffer | Uint8Array): string {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const out = bytes(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Chave pública no formato guardado no banco (JWK). */
export interface PublicJwk {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
}

/** O banco é dado externo: confere o formato antes de usar. */
export function isPublicJwk(value: unknown): value is PublicJwk {
  if (typeof value !== "object" || value === null) return false;
  const jwk = value as Record<string, unknown>;
  return jwk.kty === "EC" && jwk.crv === "P-256" && typeof jwk.x === "string" && typeof jwk.y === "string";
}

/** Chave privada embaralhada com a senha, como fica no banco. */
export interface WrappedKey {
  wrapped: string;
  salt: string;
  iv: string;
}

/** Par de chaves novo: a pública (para o banco) e a privada crua (para embaralhar em seguida). */
export async function generateKeyPair(): Promise<{ publicKey: PublicJwk; privateBytes: Uint8Array<ArrayBuffer> }> {
  const pair = await subtle().generateKey(CURVE, true, ["deriveKey"]);
  const jwk = await subtle().exportKey("jwk", pair.publicKey);
  const publicKey = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  if (!isPublicJwk(publicKey)) throw new Error("Chave pública em formato inesperado.");
  return { publicKey, privateBytes: new Uint8Array(await subtle().exportKey("pkcs8", pair.privateKey)) };
}

async function passwordKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await subtle().importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function wrapPrivateKey(privateBytes: Uint8Array<ArrayBuffer>, password: string): Promise<WrappedKey> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await passwordKey(password, salt);
  const wrapped = await subtle().encrypt({ name: "AES-GCM", iv }, key, privateBytes);
  return { wrapped: toBase64(wrapped), salt: toBase64(salt), iv: toBase64(iv) };
}

/** Devolve a privada crua. Rejeita (lança erro) se a senha não for a que embaralhou. */
export async function unwrapPrivateKey(wrappedKey: WrappedKey, password: string): Promise<Uint8Array<ArrayBuffer>> {
  const key = await passwordKey(password, fromBase64(wrappedKey.salt));
  const plain = await subtle().decrypt(
    { name: "AES-GCM", iv: fromBase64(wrappedKey.iv) },
    key,
    fromBase64(wrappedKey.wrapped),
  );
  return new Uint8Array(plain);
}

/** Chave privada pronta para uso e **não exportável**: é assim que ela fica no aparelho. */
export function importPrivateKey(privateBytes: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return subtle().importKey("pkcs8", privateBytes, CURVE, false, ["deriveKey"]);
}

/** Chave da conversa entre mim (privada) e o colega (pública). */
export async function conversationKey(privateKey: CryptoKey, peer: PublicJwk): Promise<CryptoKey> {
  const publicKey = await subtle().importKey("jwk", { ...peer }, CURVE, false, []);
  return subtle().deriveKey({ name: "ECDH", public: publicKey }, privateKey, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptText(key: CryptoKey, text: string): Promise<{ iv: string; ciphertext: string }> {
  const iv = randomBytes(12);
  const data = await subtle().encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  return { iv: toBase64(iv), ciphertext: toBase64(data) };
}

/** Embaralha os bytes de um anexo com a chave da conversa. */
export async function encryptBytes(key: CryptoKey, data: ArrayBuffer): Promise<{ iv: string; data: ArrayBuffer }> {
  const iv = randomBytes(12);
  return { iv: toBase64(iv), data: await subtle().encrypt({ name: "AES-GCM", iv }, key, data) };
}

/** Rejeita (lança erro) se a chave não for a da conversa ou o arquivo tiver sido alterado. */
export function decryptBytes(key: CryptoKey, iv: string, data: ArrayBuffer): Promise<ArrayBuffer> {
  return subtle().decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, data);
}

/** Rejeita (lança erro) se a chave não for a da conversa ou o texto tiver sido alterado. */
export async function decryptText(key: CryptoKey, iv: string, ciphertext: string): Promise<string> {
  const data = await subtle().decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(ciphertext));
  return decoder.decode(data);
}
