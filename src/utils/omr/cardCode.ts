import { MAX_CODE, MAX_SLOT } from "../assessments";
import { CODE_BITS } from "./cardLayout";

/*
 * Faixa de código do cartão (20 quadradinhos, 1 = preenchido):
 *   [1, 1, 0]  guarda: marca o início e deixa a leitura saber a orientação certa
 *   9 bits     código da avaliação (1 a 511)
 *   7 bits     número do aluno na avaliação (0 = cartão em branco, 1 a 127)
 *   1 bit      paridade par dos 16 bits de dados
 */

const GUARD = [1, 1, 0] as const;

const toBits = (value: number, size: number): number[] =>
  Array.from({ length: size }, (_, i) => (value >> (size - 1 - i)) & 1);

const fromBits = (bits: readonly number[]): number => bits.reduce((acc, bit) => (acc << 1) | bit, 0);

export function encodeCardCode(code: number, slot: number): number[] {
  if (!Number.isInteger(code) || code < 1 || code > MAX_CODE) throw new Error("Código de avaliação inválido.");
  if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) throw new Error("Número de aluno inválido.");
  const data = [...toBits(code, 9), ...toBits(slot, 7)];
  const parity = data.reduce((a, b) => a + b, 0) % 2;
  return [...GUARD, ...data, parity];
}

export function decodeCardCode(bits: readonly number[]): { code: number; slot: number } | null {
  if (bits.length !== CODE_BITS) return null;
  if (GUARD.some((bit, i) => bits[i] !== bit)) return null;
  const data = bits.slice(3, 19);
  const parity = data.reduce((a, b) => a + b, 0) % 2;
  if (parity !== bits[19]) return null;
  const code = fromBits(data.slice(0, 9));
  if (code < 1) return null;
  return { code, slot: fromBits(data.slice(9)) };
}
