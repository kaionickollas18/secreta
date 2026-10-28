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
  uploadChatFile: async () => null,
  downloadChatFile: async () => ({ data: null, error: "sem rede no teste" }),
  removeChatFile: async () => {},
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
import { useTaskStore } from "../store/taskStore";
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
import { ASSISTANT, makeMember, makeTask, SECRETARY, TEAM } from "./helpers";

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
    attachmentPath: null,
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
    useChatStore.setState({ keys: [], directs: [], plain: {}, files: {}, anonymous: [], status: "idle", lock: "checking", hasKey: false, seen: {} });
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
    // O assistente não apaga o que outra pessoa escreveu.
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

  it("mostra o anexo recebido com nome, tipo e tamanho, e o botão de baixar; só a conversa direta anexa", async () => {
    const user = userEvent.setup();
    await renderAs(SECRETARY, {
      lock: "unlocked",
      hasKey: true,
      directs: [{ ...direct("a", "ana", "sec", 9), attachmentPath: "escola/ana/arquivo" }],
      plain: { a: "" },
      files: { a: { name: "Ofício 12.pdf", type: "application/pdf", size: 850 * 1024, iv: "aXY=" } },
    });
    await user.click(await screen.findByRole("button", { name: /Souza/ }));

    const thread = within(screen.getByRole("region", { name: "Conversa: Souza" }));
    expect(thread.getByText("Ofício 12.pdf")).toBeInTheDocument();
    expect(thread.getByText("PDF · 850 KB")).toBeInTheDocument();
    expect(thread.getByRole("button", { name: "Baixar Ofício 12.pdf" })).toBeInTheDocument();
    expect(thread.getByRole("button", { name: "Anexar PDF ou imagem" })).toBeInTheDocument();

    // Sem chave neste aparelho para abrir, avisa em vez de baixar.
    await user.click(thread.getByRole("button", { name: "Baixar Ofício 12.pdf" }));
    expect(await thread.findByRole("alert")).toHaveTextContent(/não consegue abrir/);

    await user.click(screen.getByRole("button", { name: /Geral/ }));
    expect(screen.queryByRole("button", { name: "Anexar PDF ou imagem" })).not.toBeInTheDocument();
  });
});

describe("conversas: marcações, perfil e emojis (tela)", () => {
  async function renderAs(profile: Profile, muralBody = "Bom dia a todos") {
    useAuthStore.setState({ status: "signedIn", profile, error: null });
    useChatStore.setState({ status: "ready", lock: "locked", hasKey: false });
    useDirectoryStore.setState({ members: TEAM, schools: [], status: "ready" });
    useTaskStore.setState({ tasks: [makeTask({ id: "t1", title: "Pagar boleto", assignees: ["ana"] })] });
    useMessageStore.setState({
      messages: [{ id: "m1", senderId: "ana", senderName: "Ana Souza", body: muralBody, createdAt: at(8) }],
      status: "ready",
      lastSeen: null,
    });
    render(<MensagensApp />);
    await screen.findByRole("navigation", { name: "Conversas" });
  }

  beforeEach(() => {
    api.anonymous = [];
    window.history.replaceState(null, "", "/");
    useChatStore.setState({ keys: [], directs: [], plain: {}, files: {}, anonymous: [], status: "idle", lock: "checking", hasKey: false, seen: {} });
  });

  it("@ e # sugerem pessoas e tarefas, e a mensagem sai com as marcações", async () => {
    const user = userEvent.setup();
    await renderAs(SECRETARY);
    await user.click(screen.getByRole("button", { name: /Anônimo/ }));
    const field = screen.getByLabelText("Escrever mensagem");

    await user.type(field, "Oi @So");
    const people = await screen.findByRole("listbox", { name: "Pessoas para marcar" });
    expect(within(people).getByRole("option", { name: /@Souza/ })).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(field).toHaveValue("Oi @Souza ");

    await user.type(field, "veja #bol");
    await user.click(within(screen.getByRole("listbox", { name: "Tarefas para marcar" })).getByRole("option", { name: /Pagar boleto/ }));
    await user.keyboard("{Enter}");

    await waitFor(() => expect(api.anonymous).toEqual(["Oi @[Souza](u:ana) veja #[Pagar boleto](t:t1)"]));
  });

  it("Esc fecha as sugestões sem apagar o texto", async () => {
    const user = userEvent.setup();
    await renderAs(ASSISTANT);
    await user.click(screen.getByRole("button", { name: /Anônimo/ }));
    await user.type(screen.getByLabelText("Escrever mensagem"), "@Di");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Escrever mensagem")).toHaveValue("@Di");
  });

  it("a marcação abre o perfil, e do perfil dá para começar a conversa", async () => {
    const user = userEvent.setup();
    await renderAs(ASSISTANT, "Bom dia @[Dias](u:beto), veja #[Pagar boleto](t:t1)");
    await user.click(screen.getByRole("button", { name: /Geral/ }));

    await user.click(screen.getByRole("button", { name: "Ver perfil de Dias" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Perfil de Beto Dias" }));
    await user.click(dialog.getByRole("button", { name: "Conversar com Dias" }));
    expect(await screen.findByRole("region", { name: "Conversa: Dias" })).toBeInTheDocument();
  });

  it("o nome de quem escreveu abre o perfil; a tarefa marcada abre o resumo com link para o quadro", async () => {
    const user = userEvent.setup();
    await renderAs(SECRETARY, "Veja #[Pagar boleto](t:t1)");
    await user.click(screen.getByRole("button", { name: /Geral/ }));

    await user.click(screen.getByRole("button", { name: "Ver perfil de Ana Souza" }));
    expect(await screen.findByRole("dialog", { name: "Perfil de Ana Souza" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Ver tarefa Pagar boleto" }));
    const task = within(await screen.findByRole("dialog", { name: "Pagar boleto" }));
    expect(task.getByText(/Responsáveis: Souza/)).toBeInTheDocument();
    expect(task.getByRole("link", { name: "Abrir no quadro" })).toHaveAttribute("href", "index.html?tarefa=t1");
  });

  it("destaca a mensagem que me marca, avisa na lista e não confia em marcação de id desconhecido", async () => {
    const user = userEvent.setup();
    await renderAs(SECRETARY, "@[Lopes](u:sec) e @[Chefe](u:inventado)");
    const list = within(screen.getByRole("navigation", { name: "Conversas" }));
    expect(list.getByRole("button", { name: /Geral.*você foi marcado/ })).toBeInTheDocument();

    await user.click(list.getByRole("button", { name: /Geral/ }));
    expect(screen.getByText("marcou você")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chefe/ })).not.toBeInTheDocument();
    expect(screen.getByRole("log", { name: "Mensagens do mural" })).toHaveTextContent("@Chefe");
  });

  it("vindo do perfil (?com=), abre direto a conversa com a pessoa", async () => {
    window.history.replaceState(null, "", "/mensagens.html?com=beto");
    await renderAs(ASSISTANT);
    expect(await screen.findByRole("region", { name: "Conversa: Dias" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("o botão de emojis coloca o emoji no texto", async () => {
    const user = userEvent.setup();
    await renderAs(ASSISTANT);
    await user.click(screen.getByRole("button", { name: /Anônimo/ }));
    await user.type(screen.getByLabelText("Escrever mensagem"), "Valeu ");
    await user.click(screen.getByRole("button", { name: "Inserir emoji" }));
    await user.click(screen.getByRole("button", { name: "Emoji 👍" }));
    expect(screen.getByLabelText("Escrever mensagem")).toHaveValue("Valeu 👍");
    expect(screen.queryByRole("group", { name: "Emojis" })).not.toBeInTheDocument();
  });
});
