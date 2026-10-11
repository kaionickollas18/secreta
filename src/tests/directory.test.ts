import { describe, expect, it } from "vitest";
import type { Member } from "../types/directory";
import { assistantsOf, filterMembers, secretaryOf, sortSchools } from "../utils/directory";

function member(partial: Partial<Member> & Pick<Member, "id" | "fullName">): Member {
  return {
    role: "assistant",
    schoolId: "s1",
    lastName: partial.fullName.split(" ").pop() ?? "",
    email: `${partial.id}@escola.com`,
    active: true,
    ...partial,
  };
}

const members: Member[] = [
  member({ id: "sec", fullName: "Rita Lopes", role: "secretary" }),
  member({ id: "a2", fullName: "Zélia Prado" }),
  member({ id: "a1", fullName: "Álvaro Dias" }),
  member({ id: "x", fullName: "Outra Escola", schoolId: "s2" }),
];

describe("directory utils", () => {
  it("ordena escolas por nome em pt-BR", () => {
    const sorted = sortSchools([
      { id: "2", name: "Zeta" },
      { id: "1", name: "Álamo" },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["1", "2"]);
  });

  it("encontra o secretário da escola", () => {
    expect(secretaryOf("s1", members)?.id).toBe("sec");
    expect(secretaryOf("s2", members)).toBeUndefined();
  });

  it("lista só auxiliares, em ordem alfabética, e filtra por escola", () => {
    expect(assistantsOf(members).map((m) => m.id)).toEqual(["a1", "x", "a2"]);
    expect(assistantsOf(members, "s1").map((m) => m.id)).toEqual(["a1", "a2"]);
  });

  it("busca sem acento por nome ou e-mail", () => {
    expect(filterMembers(members, "alvaro").map((m) => m.id)).toEqual(["a1"]);
    expect(filterMembers(members, "A2@ESCOLA").map((m) => m.id)).toEqual(["a2"]);
    expect(filterMembers(members, "  ")).toHaveLength(members.length);
  });
});
