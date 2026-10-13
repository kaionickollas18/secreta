import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));

const api = vi.hoisted(() => ({ anonymous: [] as string[] }));
vi.mock("../store/chatApi", () => ({
  DIRECT_PAGE: 500,
  fetchChatKeys: async () => ({ data: null, error: "sem rede no teste" }),
  fetchDirectMessages: async () => ({ data: null, error: "sem rede no teste" }),
  fetchAnonymousMessages: async () => ({ data: null, error: "sem rede no teste" }),
  fetchMyWrappedKey: async () => ({ data: null, error: "sem rede no teste" }),
  sendAnonymousMessage: async (_schoolId: string, body: string) => {
    api.anonymous.push(body);
    return { data: { id: `nova-${api.anonymous.length}`, body, createdAt: new Date().toISOString(), mine: true }, error: null };
  },
  removeAnonymousMessage: async () => null,
  removeDirectMessage: async () => null,
  sendDirectMessage: async () => ({ data: null, error: "não usado" }),
  createChatKey: async () => ({ data: null, error: "não usado" }),
  rewrapChatKey: async () => null,
  verifyPassword: async () => false,
  subscribeChat: () => () => {},
}));

import MensagensApp from "../mensagens/MensagensApp";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { useDirectoryStore } from "../store/directoryStore";
import { useMessageStore } from "../store/messageStore";
import type { DirectMessage } from "../types/chat";
import type { Profile } from "../types/auth";
import {
  conversationWith,
  dmChannel,
  keysOfMessage,
  parseSeen,
  peerOfChannel,
  totalUnread,
  unreadByChannel,
} from "../utils/chat";
import { ASSISTANT, makeMember, SECRETARY, TEAM } from "./helpers";

const at = (hour: number) => new Date(2026, 9, 13, hour, 0).toISOString();

function direct(id: string, senderId: string, recipientId: string, hour: number): DirectMessage {
  return {
    id,
    senderId,
    recipientId,
    senderKeyId: `k-${senderId}`,
    recipientKeyId: `k-${recipientId}`,
    iv: "iv",
    ciphertext: "embaralhado",
    createdAt: at(hour),
  };
}

describe("conversas (regras)", () => {
  const directs = [
    direct("c", "ana", "sec", 11),
    direct("a", "sec", "ana", 9),
    direct("b", "beto", "sec", 10),
    direct("x", "ana", "beto", 8),
  ];

  it("separa a conversa com cada colega, em ordem", () => {
    expect(conversationWith(directs, "sec", "ana").map((m) => m.id)).toEqual(["a", "c"]);
    expect(conversationWith(directs, "sec", "beto").map((m) => m.id)).toEqual(["b"]);
    expect(peerOfChannel(dmChannel("ana"))).toBe("ana");
    expect(peerOfChannel("geral")).toBeNull();
  });

  it("sabe qual chave é a minha em cada mensagem", () => {
    const sent = direct("a", "sec", "ana", 9);
    expect(keysOfMessage(sent, "sec")).toEqual({ mine: "k-sec", peer: "k-ana" });
    expect(keysOfMessage(sent, "ana")).toEqual({ mine: "k-ana", peer: "k-sec" });
  });

  it("conta as não lidas por conversa, só do que recebi depois da última visita", () => {
    const anonymous = [
      { id: "1", body: "a", createdAt: at(9), mine: false },
      { id: "2", body: "b", createdAt: at(12), mine: true },
      { id: "3", body: "c", createdAt: at(13), mine: false },
    ];
    const counts = unreadByChannel(directs, anonymous, { "dm:ana": at(10), anonimo: at(10) }, "sec");
    expect(counts).toEqual({ "dm:ana": 1, "dm:beto": 1, anonimo: 1 });
    expect(totalUnread(counts)).toBe(3);
    expect(unreadByChannel(directs, [], { "dm:ana": at(12), "dm:beto": at(12) }, "sec")).toEqual({});
  });

  it("ignora um registro de visitas estragado", () => {
    expect(parseSeen(null)).toEqual({});
    expect(parseSeen("isto não é JSON")).toEqual({});
    expect(parseSeen('{"dm:ana":"2026-10-13T10:00:00.000Z","anonimo":7}')).toEqual({
      "dm:ana": "2026-10-13T10:00:00.000Z",
    });
  });
});

describe("conversas (tela)", () => {
  // Quem carrega as conversas é o AppShell; aqui o teste entrega o estado direto aos stores.
  async function renderAs(profile: Profile, chat: Partial<ReturnType<typeof useChatStore.getState>> = {}) {
    useAuthStore.setState({ status: "signedIn", profile, error: null });
    useChatStore.setState({ status: "ready", lock: "locked", hasKey: false, ...chat });
    useDirectoryStore.setState({
      members: [...TEAM, makeMember({ id: "off", fullName: "Caio Alves", active: false })],
      schools: [],
      status: "ready",
    });
    render(<MensagensApp />);
    await screen.findByRole("navigation", { name: "Conversas" });
  }

  beforeEach(() => {
    api.anonymous = [];
    useChatStore.setState({ keys: [], directs: [], plain: {}, anonymous: [], status: "idle", lock: "checking", hasKey: false, seen: {} });
    useMessageStore.setState({
      messages: [{ id: "m1", senderId: "ana", senderName: "Ana Souza", body: "Bom dia a todos", createdAt: at(8) }],
      status: "ready",
      lastSeen: null,
    });
  });

  it("lista Geral, Anônimo e cada colega ativo pelo sobrenome, com as não lidas", async () => {
    await renderAs(SECRETARY, { directs: [direct("a", "ana", "sec", 9), direct("b", "ana", "sec", 10)] });

    const list = within(screen.getByRole("navigation", { name: "Conversas" }));
    await waitFor(() => expect(list.getAllByRole("button")).toHaveLength(4));
    expect(list.getAllByRole("button").map((b) => b.querySelector("span.truncate.font-semibold")?.textContent)).toEqual([
      "Geral",
      "Anônimo",
      "Souza",
      "Dias",
    ]);
    expect(list.getByRole("button", { name: /Souza.*2 mensagens novas/ })).toBeInTheDocument();
    expect(list.getByRole("button", { name: /Geral.*1 mensagem nova/ })).toBeInTheDocument();
  });

  it("Geral é o mural de todos", async () => {
    const user = userEvent.setup();
    await renderAs(ASSISTANT);
    await user.click(screen.getByRole("button", { name: /Geral/ }));

    const thread = within(screen.getByRole("region", { name: "Conversa: Geral" }));
    expect(thread.getByRole("log", { name: "Mensagens do mural" })).toHaveTextContent("Bom dia a todos");
    expect(thread.getByText("Você")).toBeInTheDocument();
  });

  it("no Anônimo a mensagem aparece sem nome e com o aviso das regras", async () => {
    const user = userEvent.setup();
    await renderAs(ASSISTANT, { anonymous: [{ id: "1", body: "Falta papel na sala 2", createdAt: at(9), mine: false }] });
    await user.click(screen.getByRole("button", { name: /Anônimo/ }));

    const thread = within(screen.getByRole("region", { name: "Conversa: Anônimo" }));
    expect(thread.getByText(/Seus colegas não veem quem escreveu/)).toBeInTheDocument();
    expect(thread.getByText("Falta papel na sala 2")).toBeInTheDocument();
    // O auxiliar não apaga o que outra pessoa escreveu.
    expect(thread.queryByRole("button", { name: /^Apagar mensagem/ })).not.toBeInTheDocument();

    await user.type(thread.getByLabelText("Escrever mensagem"), "Concordo{Enter}");
    expect(await thread.findByText("Você (anônimo)")).toBeInTheDocument();
    expect(api.anonymous).toEqual(["Concordo"]);
  });

  it("o secretário modera o canal anônimo", async () => {
    const user = userEvent.setup();
    await renderAs(SECRETARY, { anonymous: [{ id: "1", body: "Texto impróprio", createdAt: at(9), mine: false }] });
    await user.click(screen.getByRole("button", { name: /Anônimo/ }));

    await user.click(screen.getByRole("button", { name: /^Apagar mensagem de Anônimo/ }));
    await user.click(within(await screen.findByRole("dialog", { name: "Apagar mensagem?" })).getByRole("button", { name: "Apagar" }));
    await waitFor(() => expect(screen.queryByText("Texto impróprio")).not.toBeInTheDocument());
  });

  it("a conversa com um colega pede a senha enquanto o aparelho não tem a chave", async () => {
    const user = userEvent.setup();
    await renderAs(SECRETARY);
    await user.click(await screen.findByRole("button", { name: /Souza/ }));

    const thread = within(screen.getByRole("region", { name: "Conversa: Souza" }));
    expect(thread.getByRole("heading", { name: "Ana Souza" })).toBeInTheDocument();
    expect(thread.getByRole("heading", { name: "Ativar conversas protegidas" })).toBeInTheDocument();
    await user.click(thread.getByRole("button", { name: "Ativar conversas" }));
    expect(thread.getByText("Digite a sua senha.")).toBeInTheDocument();
  });

  it("aberta, mostra o texto; o que não abre aparece como protegido; sem chave do colega não envia", async () => {
    const user = userEvent.setup();
    await renderAs(SECRETARY, {
      lock: "unlocked",
      hasKey: true,
      directs: [direct("a", "ana", "sec", 9), direct("b", "sec", "ana", 10)],
      plain: { a: "Pode assinar o memorando?", b: null },
    });
    await user.click(await screen.findByRole("button", { name: /Souza/ }));

    const thread = within(screen.getByRole("region", { name: "Conversa: Souza" }));
    expect(thread.getByText("Pode assinar o memorando?")).toBeInTheDocument();
    expect(thread.getByText("Mensagem protegida que este aparelho não consegue abrir.")).toBeInTheDocument();
    expect(thread.getByLabelText("Escrever mensagem")).toBeDisabled();
    expect(thread.getByText(/Souza ainda não ativou as conversas protegidas/)).toBeInTheDocument();
    // Só apago o que eu enviei.
    expect(thread.getAllByRole("button", { name: /^Apagar mensagem/ })).toHaveLength(1);
  });
});
