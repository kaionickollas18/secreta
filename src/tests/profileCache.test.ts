import { describe, expect, it } from "vitest";
import { parseCachedProfile } from "../utils/profileCache";

const secretary = { id: "u1", role: "secretary", schoolId: "s1", fullName: "Rita Lopes", lastName: "Lopes" };

describe("perfil guardado no navegador", () => {
  it("devolve o perfil quando o conteúdo é válido", () => {
    expect(parseCachedProfile(JSON.stringify(secretary))).toEqual(secretary);
    expect(
      parseCachedProfile(JSON.stringify({ ...secretary, role: "master", schoolId: null })),
    ).toMatchObject({ role: "master", schoolId: null });
  });

  it("descarta campos extras que alguém possa ter acrescentado", () => {
    const parsed = parseCachedProfile(JSON.stringify({ ...secretary, admin: true }));
    expect(parsed).toEqual(secretary);
  });

  it("guarda a foto só quando o endereço é https", () => {
    const withPhoto = { ...secretary, avatarPath: "u1/foto.jpg", avatarUrl: "https://exemplo.com/foto.jpg" };
    expect(parseCachedProfile(JSON.stringify(withPhoto))).toEqual(withPhoto);
    expect(
      parseCachedProfile(JSON.stringify({ ...withPhoto, avatarUrl: "javascript:alert(1)" })),
    ).toEqual(secretary);
    expect(parseCachedProfile(JSON.stringify({ ...secretary, avatarUrl: "https://exemplo.com/a.jpg" }))).toEqual(
      secretary,
    );
  });

  it("guarda o acesso especial só para assistente", () => {
    const assistant = { ...secretary, role: "assistant" };
    expect(parseCachedProfile(JSON.stringify({ ...assistant, elevated: true }))).toEqual({ ...assistant, elevated: true });
    expect(parseCachedProfile(JSON.stringify({ ...assistant, elevated: "sim" }))).toEqual(assistant);
    expect(parseCachedProfile(JSON.stringify({ ...secretary, elevated: true }))).toEqual(secretary);
  });

  it("ignora conteúdo ausente, corrompido ou incompleto", () => {
    expect(parseCachedProfile(null)).toBeNull();
    expect(parseCachedProfile("")).toBeNull();
    expect(parseCachedProfile("{não é json")).toBeNull();
    expect(parseCachedProfile("42")).toBeNull();
    expect(parseCachedProfile(JSON.stringify({ ...secretary, id: "" }))).toBeNull();
    expect(parseCachedProfile(JSON.stringify({ ...secretary, fullName: 7 }))).toBeNull();
  });

  it("recusa papel desconhecido e combinações impossíveis de papel e escola", () => {
    expect(parseCachedProfile(JSON.stringify({ ...secretary, role: "diretor" }))).toBeNull();
    // Master com escola e secretário sem escola não existem no sistema.
    expect(parseCachedProfile(JSON.stringify({ ...secretary, role: "master" }))).toBeNull();
    expect(parseCachedProfile(JSON.stringify({ ...secretary, schoolId: null }))).toBeNull();
  });
});
