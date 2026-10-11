import { describe, expect, it } from "vitest";
import type { Message } from "../types/message";
import { countUnread, dayLabel, groupByDay, MESSAGE_MAX, validateMessage } from "../utils/messages";

// Datas montadas no horário local, para o teste não depender do fuso da máquina.
const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0).toISOString();
const now = new Date(2026, 9, 10, 18, 0);

function message(id: string, senderId: string, createdAt: string): Message {
  return { id, senderId, senderName: senderId, body: "oi", createdAt };
}

describe("mensagens do mural", () => {
  it("valida o texto: apara, exige conteúdo e limita o tamanho", () => {
    expect(validateMessage("  Bom dia  ")).toEqual({ valid: true, value: "Bom dia" });
    expect(validateMessage("   \n ").valid).toBe(false);
    expect(validateMessage("a".repeat(MESSAGE_MAX + 1)).valid).toBe(false);
    expect(validateMessage("a".repeat(MESSAGE_MAX)).valid).toBe(true);
  });

  it("rotula os dias como Hoje, Ontem ou a data", () => {
    expect(dayLabel(at(10, 9), now)).toBe("Hoje");
    expect(dayLabel(at(9, 23), now)).toBe("Ontem");
    expect(dayLabel(at(1, 9), now)).toBe("01/10/2026");
  });

  it("agrupa por dia mantendo a ordem", () => {
    const groups = groupByDay(
      [message("a", "ana", at(9, 8)), message("b", "sec", at(9, 9)), message("c", "ana", at(10, 7))],
      now,
    );
    expect(groups.map((g) => [g.label, g.messages.map((m) => m.id)])).toEqual([
      ["Ontem", ["a", "b"]],
      ["Hoje", ["c"]],
    ]);
  });

  it("conta como não lidas só as mensagens de outras pessoas após a última visita", () => {
    const list = [message("a", "ana", at(9, 8)), message("b", "sec", at(10, 9)), message("c", "ana", at(10, 10))];
    expect(countUnread(list, at(9, 12), "sec")).toBe(1);
    expect(countUnread(list, at(9, 12), "beto")).toBe(2);
    expect(countUnread(list, null, "sec")).toBe(2);
    expect(countUnread(list, at(10, 11), "sec")).toBe(0);
  });
});
