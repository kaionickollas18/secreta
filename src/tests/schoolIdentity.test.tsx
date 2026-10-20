import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StudentDocument } from "../components/attendance/StudentDocument";
import type { StudentReport } from "../types/attendance";
import {
  EMPTY_IDENTITY,
  fitLogo,
  formatCep,
  hasIdentity,
  identityFromRow,
  validateIdentity,
  validateLogoFile,
} from "../utils/schoolIdentity";

// Escola fictícia: nenhum dado real entra nos testes.
const IDENTITY = {
  officialName: "EMEF Escola de Exemplo",
  inep: "12345678",
  address: "Rua das Flores, sem número, Bairro: Centro",
  cep: "69400-000",
  decree: "Lei Municipal nº 100 de 01/01/2020",
  logoUrl: "https://exemplo.test/logo.png",
};

const REPORT: StudentReport = {
  name: "Aluno de Exemplo",
  className: "6 ano A",
  absences: 3,
  schoolDays: 40,
  rate: 0.075,
  streak: 0,
  risk: "ok",
  presenceRate: 0.925,
  lastAbsence: "2026-09-18",
  months: [
    { month: "2026-08", label: "agosto de 2026", schoolDays: 20, absences: 1, presenceRate: 0.95, risk: "ok", dates: ["2026-08-07"] },
    { month: "2026-09", label: "setembro de 2026", schoolDays: 20, absences: 2, presenceRate: 0.9, risk: "ok", dates: ["2026-09-04", "2026-09-18"] },
  ],
};

describe("dados da escola", () => {
  it("normaliza INEP e CEP e exige só o nome", () => {
    expect(
      validateIdentity({ officialName: "  EMEF  Escola de Exemplo ", inep: "1234 5678", address: " Rua das Flores ", cep: "69.400-000", decree: "" }),
    ).toEqual({
      valid: true,
      value: { officialName: "EMEF Escola de Exemplo", inep: "12345678", address: "Rua das Flores", cep: "69400-000", decree: "" },
    });
    expect(validateIdentity({ officialName: "Escola", inep: "", address: "", cep: "", decree: "" }).valid).toBe(true);

    const result = validateIdentity({ officialName: "", inep: "123", address: "", cep: "69400", decree: "" });
    expect(result.valid ? [] : Object.keys(result.errors).sort()).toEqual(["cep", "inep", "officialName"]);
  });

  it("formata o CEP e lê a linha do banco com segurança", () => {
    expect(formatCep("69400-000")).toBe("69.400-000");
    expect(formatCep("")).toBe("");
    expect(identityFromRow(null)).toEqual(EMPTY_IDENTITY);
    expect(identityFromRow({ official_name: "Escola", inep: 12345678, address: null, cep: "69400-000", decree: null, logo_path: "s/l.png" })).toEqual({
      officialName: "Escola",
      inep: "",
      address: "",
      cep: "69400-000",
      decree: "",
      logoPath: "s/l.png",
    });
    expect(hasIdentity(EMPTY_IDENTITY)).toBe(false);
    expect(hasIdentity(IDENTITY)).toBe(true);
  });

  it("aceita só imagens como logo e reduz sem deformar", () => {
    expect(validateLogoFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateLogoFile({ type: "application/pdf", size: 1000 })).toContain("PNG");
    expect(validateLogoFile({ type: "image/png", size: 20 * 1024 * 1024 })).toContain("10 MB");
    expect(fitLogo(1000, 1000)).toEqual({ width: 600, height: 600 });
    expect(fitLogo(1200, 600)).toEqual({ width: 600, height: 300 });
    expect(fitLogo(200, 100)).toEqual({ width: 200, height: 100 });
  });
});

describe("documento de frequência do aluno (PDF)", () => {
  it("traz o cabeçalho da escola, os dados do aluno, os meses e a logo ao fundo", () => {
    render(<StudentDocument report={REPORT} identity={IDENTITY} issuedBy="Rita Lopes" issuedOn="2026-10-13" />);
    const doc = document.body.querySelector(".print-document");
    expect(doc).not.toBeNull();
    const text = doc?.textContent ?? "";

    expect(text).toContain("EMEF Escola de Exemplo");
    expect(text).toContain("INEP: 12345678");
    expect(text).toContain("CEP: 69.400-000");
    expect(text).toContain("Lei Municipal nº 100 de 01/01/2020");
    expect(text).toContain("Relatório de Frequência do Aluno");
    expect(text).toContain("Aluno de Exemplo");
    expect(text).toContain("3 em 40 dias de chamada");
    // Na tabela, só o dia das faltas (o mês já está na linha).
    expect(text).toContain("04, 18");
    expect(text).toContain("Emitido em 13/10/2026 por Rita Lopes.");
    expect(doc?.querySelector("img.print-watermark")).toHaveAttribute("src", IDENTITY.logoUrl);
    // Uma linha por mês na tabela, o gráfico e o período do relatório.
    expect(doc?.querySelectorAll("tbody tr")).toHaveLength(REPORT.months.length);
    expect(doc?.querySelectorAll("svg.doc-chart-svg circle")).toHaveLength(REPORT.months.length);
    expect(text).toContain("Período: agosto a setembro de 2026");
    expect(text).toContain("Situação: Regular");
    expect(text).toContain("93%");
    expect(text).toContain("Assinatura e carimbo");
  });

  it("sem os dados da escola, sai sem logo e com o cabeçalho mínimo", () => {
    render(<StudentDocument report={REPORT} identity={EMPTY_IDENTITY} issuedBy="Rita Lopes" issuedOn="2026-10-13" />);
    const doc = document.body.querySelector(".print-document");
    expect(doc?.querySelector("img")).toBeNull();
    expect(doc?.textContent).not.toContain("INEP");
  });
});
