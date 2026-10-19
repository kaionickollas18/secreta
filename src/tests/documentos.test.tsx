import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));

const api = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], calls: [] as unknown[] }));
vi.mock("../store/documentApi", () => {
  const find = (id: string) => api.rows.find((row) => row.id === id);
  return {
    fetchDocuments: async () => ({ data: api.rows.map((row) => ({ ...row })), error: null }),
    saveDocument: async (_schoolId: string, input: Record<string, unknown>, id?: string) => {
      api.calls.push(["save", input, id]);
      const row = { ...(id ? find(id) : { id: `novo-${api.rows.length + 1}` }), ...input };
      api.rows = [...api.rows.filter((r) => r.id !== row.id), row];
      return { data: { ...row }, error: null };
    },
    setDelivery: async (id: string, delivery: Record<string, unknown> | null) => {
      api.calls.push(["delivery", id, delivery]);
      const rest = { ...find(id) };
      delete rest.deliveredOn;
      delete rest.receivedBy;
      const row = delivery ? { ...rest, ...delivery } : rest;
      api.rows = [...api.rows.filter((r) => r.id !== id), row];
      return { data: { ...row }, error: null };
    },
    removeDocument: async (id: string) => {
      api.rows = api.rows.filter((r) => r.id !== id);
      return null;
    },
  };
});

import DocumentosApp from "../documentos/DocumentosApp";
import { useAuthStore } from "../store/authStore";
import { useDocumentStore } from "../store/documentStore";
import { useToastStore } from "../store/toastStore";
import type { OfficialDocument } from "../types/officialDocument";
import { todayISO } from "../utils/date";
import {
  boardYears,
  countPending,
  DOCUMENT_VIEW_KEY,
  documentFromRow,
  documentTitle,
  filterDocuments,
  formatDocumentNumber,
  numberBoard,
  parseDocumentNumber,
  sortDocuments,
  validateDeliveryForm,
  validateDocumentForm,
} from "../utils/officialDocuments";
import { canDeleteDocuments } from "../utils/roles";
import { ASSISTANT, SECRETARY } from "./helpers";

function makeDocument(overrides: Partial<OfficialDocument> = {}): OfficialDocument {
  return {
    id: "d1",
    kind: "memo",
    number: "012/2026",
    issuedOn: "2026-10-01",
    recipient: "SEMEC",
    subject: "Frequência de pessoal",
    ...overrides,
  };
}

describe("memorandos e ofícios (regras)", () => {
  it("valida o registro: número, data, destinatário e assunto", () => {
    const base = { kind: "oficio", number: " 045/2026 ", issuedOn: "2026-10-05", recipient: "  Conselho  Tutelar ", subject: "Encaminhamento", summary: "" } as const;
    expect(validateDocumentForm(base)).toEqual({
      valid: true,
      value: { kind: "oficio", number: "045/2026", issuedOn: "2026-10-05", recipient: "Conselho Tutelar", subject: "Encaminhamento", summary: undefined },
    });
    const errorsOf = (values: Parameters<typeof validateDocumentForm>[0], delivered?: { deliveredOn: string }) => {
      const result = validateDocumentForm(values, delivered);
      return result.valid ? {} : result.errors;
    };
    expect(Object.keys(errorsOf({ ...base, number: "", issuedOn: "2026-02-30", recipient: " ", subject: "" })).sort()).toEqual([
      "issuedOn",
      "number",
      "recipient",
      "subject",
    ]);
    // Já entregue: o resumo não pode sumir e a data não passa da entrega.
    expect(errorsOf(base, { deliveredOn: "2026-10-06" }).summary).toBeDefined();
    expect(errorsOf({ ...base, summary: "Resumo", issuedOn: "2026-10-07" }, { deliveredOn: "2026-10-06" }).issuedOn).toContain("06/10/2026");
  });

  it("marcar a entrega exige o resumo e uma data entre a do documento e hoje", () => {
    const today = "2026-10-13";
    expect(validateDeliveryForm({ summary: " Encaminha a frequência. ", deliveredOn: "2026-10-10", receivedBy: " Maria " }, "2026-10-01", today)).toEqual({
      valid: true,
      value: { summary: "Encaminha a frequência.", deliveredOn: "2026-10-10", receivedBy: "Maria" },
    });
    const errorsOf = (values: Parameters<typeof validateDeliveryForm>[0]) => {
      const result = validateDeliveryForm(values, "2026-10-01", today);
      return result.valid ? {} : result.errors;
    };
    expect(errorsOf({ summary: "  ", deliveredOn: "2026-10-10", receivedBy: "" }).summary).toContain("resumo");
    expect(errorsOf({ summary: "ok", deliveredOn: "2026-09-30", receivedBy: "" }).deliveredOn).toContain("01/10/2026");
    expect(errorsOf({ summary: "ok", deliveredOn: "2026-10-14", receivedBy: "" }).deliveredOn).toContain("futuro");
  });

  it("ordena: pendentes do mais antigo ao mais novo, depois entregues do mais recente", () => {
    const list = [
      makeDocument({ id: "entregue-antigo", deliveredOn: "2026-10-02", summary: "x" }),
      makeDocument({ id: "pendente-novo", issuedOn: "2026-10-09" }),
      makeDocument({ id: "entregue-novo", deliveredOn: "2026-10-12", summary: "x" }),
      makeDocument({ id: "pendente-antigo", issuedOn: "2026-09-20" }),
    ];
    expect(sortDocuments(list).map((d) => d.id)).toEqual(["pendente-antigo", "pendente-novo", "entregue-novo", "entregue-antigo"]);
    expect(countPending(list)).toBe(2);
    expect(filterDocuments(list, "delivered").map((d) => d.id)).toEqual(["entregue-antigo", "entregue-novo"]);
    expect(filterDocuments(list, "all")).toHaveLength(4);
  });

  it("converte a linha do banco e recusa as malformadas", () => {
    const row = { id: "d1", kind: "oficio", number: "1/2026", issued_on: "2026-10-01", recipient: "SEMEC", subject: "A", summary: null, delivered_on: null, received_by: null };
    expect(documentFromRow(row)).toEqual({ id: "d1", kind: "oficio", number: "1/2026", issuedOn: "2026-10-01", recipient: "SEMEC", subject: "A", summary: undefined, deliveredOn: undefined, receivedBy: undefined });
    expect(documentFromRow({ ...row, kind: "carta" })).toBeNull();
    expect(documentFromRow({ ...row, issued_on: "ontem" })).toBeNull();
    expect(documentTitle(makeDocument({ kind: "oficio", number: "7/2026" }))).toBe("Ofício nº 7/2026");
    expect(canDeleteDocuments("secretary")).toBe(true);
    expect(canDeleteDocuments("assistant")).toBe(false);
  });
});

describe("quadro de números (regras)", () => {
  it("lê o número e o ano do documento", () => {
    expect(parseDocumentNumber("012/2026")).toEqual({ sequence: 12, year: 2026 });
    expect(parseDocumentNumber("Nº 73")).toEqual({ sequence: 73, year: undefined });
    expect(parseDocumentNumber("7/26")).toEqual({ sequence: 7, year: 2026 });
    expect(parseDocumentNumber("s/n")).toBeNull();
    expect(parseDocumentNumber("000/2026")).toBeNull();
    expect(formatDocumentNumber(73, 2026)).toBe("073/2026");
  });

  it("monta a grade do tipo e do ano, com linha livre depois do último número", () => {
    const list = [
      makeDocument({ id: "a", number: "001/2026", deliveredOn: "2026-10-02", summary: "x" }),
      makeDocument({ id: "b", number: "003/2026" }),
      makeDocument({ id: "repetido", number: "3/2026" }),
      makeDocument({ id: "oficio", kind: "oficio", number: "002/2026" }),
      makeDocument({ id: "antigo", number: "002/2025", issuedOn: "2025-03-01" }),
      // Sem ano no número: vale o ano da data.
      makeDocument({ id: "sem-ano", number: "41", issuedOn: "2026-05-01" }),
    ];
    const board = numberBoard(list, "memo", 2026);
    // 41 está na 6ª linha de 8; o quadro vai até o fim da 7ª.
    expect(board).toHaveLength(56);
    expect(board.slice(0, 3).map((c) => [c.sequence, c.state, c.document?.id])).toEqual([
      [1, "delivered", "a"],
      [2, "free", undefined],
      [3, "pending", "b"],
    ]);
    expect(board[40]).toMatchObject({ sequence: 41, state: "pending" });
    expect(numberBoard(list, "oficio", 2026)[1]).toMatchObject({ sequence: 2, state: "pending" });
    expect(numberBoard([], "memo", 2026)).toHaveLength(40);
    expect(boardYears(list, 2027)).toEqual([2027, 2026, 2025]);
  });
});

describe("quadro de números (tela)", () => {
  const year = Number(todayISO().slice(0, 4));

  beforeEach(() => {
    api.rows = [];
    api.calls = [];
    useDocumentStore.setState({ documents: [], status: "idle" });
    useToastStore.getState().clear();
    useAuthStore.setState({ status: "signedIn", profile: ASSISTANT, error: null });
  });

  it("é a visão inicial; tocar em um número livre registra o documento com esse número", async () => {
    const user = userEvent.setup();
    render(<DocumentosApp />);
    const board = within(await screen.findByRole("list", { name: `Números de memorando de ${year}` }));
    expect(board.getAllByRole("button")).toHaveLength(40);

    await user.click(board.getByRole("button", { name: `Memorando 7 de ${year}: livre` }));
    const dialog = within(await screen.findByRole("dialog", { name: "Novo documento" }));
    expect(dialog.getByLabelText("Número *")).toHaveValue(formatDocumentNumber(7, year));
    await user.type(dialog.getByLabelText("Para quem *"), "SEMEC");
    await user.type(dialog.getByLabelText("Assunto *"), "Frequência de pessoal");
    await user.click(dialog.getByRole("button", { name: "Registrar documento" }));

    expect(
      await board.findByRole("button", { name: `Memorando 7 de ${year}: feito, aguardando entrega. Frequência de pessoal` }),
    ).toBeInTheDocument();
  });

  it("número aguardando abre a entrega; entregue abre o documento com o resumo", async () => {
    const user = userEvent.setup();
    api.rows = [
      { ...makeDocument({ id: "p", number: formatDocumentNumber(2, year), issuedOn: `${year}-01-05` }) },
      { ...makeDocument({ id: "e", number: formatDocumentNumber(1, year), issuedOn: `${year}-01-02`, deliveredOn: `${year}-01-03`, summary: "Encaminha a frequência." }) },
    ];
    render(<DocumentosApp />);
    const board = within(await screen.findByRole("list", { name: `Números de memorando de ${year}` }));

    await user.click(board.getByRole("button", { name: new RegExp(`^Memorando 2 de ${year}: feito, aguardando entrega`) }));
    const delivery = await screen.findByRole("dialog", { name: "Marcar entrega" });
    await user.click(within(delivery).getByRole("button", { name: "Cancelar" }));

    await user.click(board.getByRole("button", { name: new RegExp(`^Memorando 1 de ${year}: entregue em 03/01/${year}`) }));
    const details = within(await screen.findByRole("dialog", { name: `Memorando nº ${formatDocumentNumber(1, year)}` }));
    expect(details.getByText("Encaminha a frequência.")).toBeInTheDocument();

    // Os ofícios têm a numeração deles.
    await user.click(details.getByRole("button", { name: "Fechar" }));
    await user.click(screen.getByRole("button", { name: "Ofícios" }));
    expect(await screen.findByRole("button", { name: `Ofício 1 de ${year}: livre` })).toBeInTheDocument();
  });
});

describe("memorandos e ofícios (tela)", () => {
  beforeEach(() => {
    // Estes testes são da lista; a visão inicial é o quadro de números.
    window.localStorage.setItem(DOCUMENT_VIEW_KEY, "list");
    api.rows = [];
    api.calls = [];
    useDocumentStore.setState({ documents: [], status: "idle" });
    useToastStore.getState().clear();
    useAuthStore.setState({ status: "signedIn", profile: ASSISTANT, error: null });
  });

  it("registra um documento e ele aparece aguardando entrega", async () => {
    const user = userEvent.setup();
    render(<DocumentosApp />);
    expect(await screen.findByText("Nenhum documento registrado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Novo documento" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Novo documento" }));
    await user.click(dialog.getByRole("button", { name: "Registrar documento" }));
    expect(dialog.getByText("Informe o número do documento.")).toBeInTheDocument();

    await user.selectOptions(dialog.getByLabelText("Tipo"), "oficio");
    await user.type(dialog.getByLabelText("Número *"), "045/2026");
    await user.type(dialog.getByLabelText("Para quem *"), "Conselho Tutelar");
    await user.type(dialog.getByLabelText("Assunto *"), "Encaminhamento de aluno");
    await user.click(dialog.getByRole("button", { name: "Registrar documento" }));

    const card = within((await screen.findByRole("heading", { name: "Ofício nº 045/2026" })).closest("li") as HTMLElement);
    expect(card.getByText("Aguardando entrega")).toBeInTheDocument();
    expect(screen.getByText("1 documento aguarda entrega.")).toBeInTheDocument();
  });

  it("marcar como entregue pede o resumo e depois o mostra no documento", async () => {
    const user = userEvent.setup();
    api.rows = [{ ...makeDocument() }];
    render(<DocumentosApp />);

    await user.click(await screen.findByRole("button", { name: "Marcar Memorando nº 012/2026 como entregue" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Marcar entrega" }));
    expect(dialog.getByText("Frequência de pessoal")).toBeInTheDocument();
    expect(dialog.getByLabelText("Entregue em *")).toHaveValue(todayISO());

    await user.click(dialog.getByRole("button", { name: "Marcar como entregue" }));
    expect(dialog.getByText("Escreva um resumo do que se trata o documento.")).toBeInTheDocument();

    await user.type(dialog.getByLabelText("Resumo do que se trata *"), "Encaminha a frequência dos servidores de outubro.");
    await user.type(dialog.getByLabelText("Quem recebeu"), "Maria");
    await user.click(dialog.getByRole("button", { name: "Marcar como entregue" }));

    // Sai da lista de pendentes e aparece em Entregues, com o resumo.
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Memorando nº 012/2026" })).not.toBeInTheDocument());
    expect(screen.getByText("Nada aguardando entrega")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Entregues/ }));
    const card = within(screen.getByRole("heading", { name: "Memorando nº 012/2026" }).closest("li") as HTMLElement);
    expect(card.getByText("Encaminha a frequência dos servidores de outubro.")).toBeInTheDocument();
    expect(card.getByText(/^Entregue em /)).toBeInTheDocument();
    expect(card.getByText("Recebido por Maria")).toBeInTheDocument();

    await user.click(card.getByRole("button", { name: "Desfazer a entrega de Memorando nº 012/2026" }));
    await waitFor(() => expect(api.calls[api.calls.length - 1]).toEqual(["delivery", "d1", null]));
  });

  it("só o secretário vê a lixeira", async () => {
    api.rows = [{ ...makeDocument() }];
    const view = render(<DocumentosApp />);
    await screen.findByRole("heading", { name: "Memorando nº 012/2026" });
    expect(screen.getByRole("button", { name: "Editar Memorando nº 012/2026" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir Memorando nº 012/2026" })).not.toBeInTheDocument();
    view.unmount();

    useAuthStore.setState({ status: "signedIn", profile: SECRETARY, error: null });
    render(<DocumentosApp />);
    expect(await screen.findByRole("button", { name: "Excluir Memorando nº 012/2026" })).toBeInTheDocument();
  });
});
