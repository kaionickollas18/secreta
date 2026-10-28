import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));
vi.mock("../store/taskApi", () => import("./fakeTaskApi"));

const api = vi.hoisted(() => ({
  saved: [] as { input: unknown; id?: string }[],
  toggled: [] as unknown[],
  failToggle: false,
}));
vi.mock("../store/noteApi", () => ({
  fetchNotes: async () => ({ data: null, error: "sem rede no teste" }),
  saveNote: async (_schoolId: string, input: Record<string, unknown>, id?: string) => {
    api.saved.push({ input, id });
    return {
      data: {
        id: id ?? "nova",
        authorId: "ana",
        authorName: "Ana Souza",
        createdAt: "2026-10-13T12:00:00.000Z",
        updatedAt: "2026-10-13T12:00:00.000Z",
        ...input,
      },
      error: null,
    };
  },
  removeNote: async () => null,
  setItemDone: async (...args: unknown[]) => {
    api.toggled.push(args);
    return api.failToggle ? "Não foi possível marcar o item. Tente de novo." : null;
  },
  subscribeNotes: () => () => {},
}));

import { LinkedNotes } from "../components/notes/LinkedNotes";
import NotasApp from "../notas/NotasApp";
import { useAuthStore } from "../store/authStore";
import { useNoteStore } from "../store/noteStore";
import { useReminderStore } from "../store/reminderStore";
import { useTaskStore } from "../store/taskStore";
import { useToastStore } from "../store/toastStore";
import type { Profile } from "../types/auth";
import type { Note } from "../types/note";
import {
  linkFromSearch,
  linkFromValue,
  newNoteHref,
  noteFromRow,
  noteProgress,
  notesLinkedTo,
  noteToRow,
  pendingItems,
  validateNoteForm,
} from "../utils/notes";
import { canDeleteNote } from "../utils/roles";
import { db, resetDb } from "./fakeTaskApi";
import { ASSISTANT, makeTask, SECRETARY } from "./helpers";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "n1",
    title: "Ornamentação",
    kind: "checklist",
    items: [
      { id: "a", text: "Balões", done: true },
      { id: "b", text: "Fita adesiva", done: false },
    ],
    authorId: "ana",
    authorName: "Ana Souza",
    createdAt: "2026-10-12T10:00:00.000Z",
    updatedAt: "2026-10-12T10:00:00.000Z",
    ...overrides,
  };
}

describe("regras das notas", () => {
  it("valida o texto e monta a lista, um item por linha", () => {
    let n = 0;
    const result = validateNoteForm(
      { title: " Ornamentação ", kind: "checklist", body: "ignorado", itemsText: "Balões\n\n  Toalhas \nFita adesiva", link: "task:t1" },
      [
        { id: "a", text: "Balões", done: true },
        { id: "b", text: "Fita adesiva", done: false },
      ],
      () => `novo-${(n += 1)}`,
    );
    expect(result).toEqual({
      valid: true,
      value: {
        title: "Ornamentação",
        kind: "checklist",
        body: undefined,
        // Quem já existia mantém o id e a marcação; a linha nova entra desmarcada.
        items: [
          { id: "a", text: "Balões", done: true },
          { id: "novo-1", text: "Toalhas", done: false },
          { id: "b", text: "Fita adesiva", done: false },
        ],
        link: { type: "task", id: "t1" },
      },
    });

    const errorsOf = (values: Parameters<typeof validateNoteForm>[0]) => {
      const r = validateNoteForm(values);
      return r.valid ? {} : r.errors;
    };
    const base = { title: "Nota", kind: "text", body: "", itemsText: "", link: "" } as const;
    expect(validateNoteForm(base).valid).toBe(true);
    expect(errorsOf({ ...base, title: "  " }).title).toBeDefined();
    expect(errorsOf({ ...base, kind: "checklist" }).itemsText).toContain("pelo menos um item");
    expect(errorsOf({ ...base, kind: "checklist", itemsText: "x".repeat(201) }).itemsText).toContain("200");
    expect(errorsOf({ ...base, kind: "checklist", itemsText: Array(61).fill("item").join("\n") }).itemsText).toContain("60");
  });

  it("converte de e para o banco, recusando linhas malformadas", () => {
    const row = {
      id: "n1",
      title: "Ornamentação",
      kind: "checklist",
      body: null,
      items: [{ id: "a", text: "Balões", done: false }],
      task_id: null,
      reminder_id: "r1",
      author_id: null,
      author_name: "Ana Souza",
      created_at: "2026-10-12T10:00:00.000Z",
      updated_at: "2026-10-12T11:00:00.000Z",
    };
    expect(noteFromRow(row)).toMatchObject({ link: { type: "reminder", id: "r1" }, authorId: undefined, body: undefined });
    expect(noteFromRow({ ...row, kind: "planilha" })).toBeNull();
    expect(noteFromRow({ ...row, items: [{ id: "a", text: "Balões" }] })).toBeNull();
    expect(noteFromRow({ ...row, items: "[]" })).toBeNull();

    expect(noteToRow({ title: "T", kind: "text", body: "oi", items: [{ id: "x", text: "y", done: true }], link: { type: "task", id: "t1" } })).toEqual({
      title: "T",
      kind: "text",
      body: "oi",
      items: [],
      task_id: "t1",
      reminder_id: null,
    });
  });

  it("conta o que falta e acha as notas de uma tarefa ou lembrete", () => {
    const a = makeNote({ id: "a", link: { type: "task", id: "t1" } });
    const b = makeNote({ id: "b", link: { type: "reminder", id: "t1" }, updatedAt: "2026-10-13T10:00:00.000Z" });
    const c = makeNote({ id: "c", kind: "text", items: [], body: "Texto", link: { type: "task", id: "t1" }, updatedAt: "2026-10-13T10:00:00.000Z" });
    expect(noteProgress(a)).toEqual({ done: 1, total: 2 });
    expect(pendingItems([a, b, c])).toBe(2);
    expect(notesLinkedTo([a, b, c], { type: "task", id: "t1" }).map((n) => n.id)).toEqual(["c", "a"]);
  });

  it("lê o vínculo do endereço e do campo do formulário", () => {
    expect(linkFromSearch("?tarefa=t1")).toEqual({ type: "task", id: "t1" });
    expect(linkFromSearch("?lembrete=r1")).toEqual({ type: "reminder", id: "r1" });
    expect(linkFromSearch("")).toBeUndefined();
    expect(newNoteHref({ type: "task", id: "t1" })).toBe("notas.html?tarefa=t1");
    expect(linkFromValue("reminder:r1")).toEqual({ type: "reminder", id: "r1" });
    expect(linkFromValue("")).toBeUndefined();
    expect(linkFromValue("tasks")).toBeUndefined();
    expect(linkFromValue("outro:1")).toBeUndefined();
  });

  it("só quem escreveu ou o secretário exclui", () => {
    expect(canDeleteNote("assistant", true)).toBe(true);
    expect(canDeleteNote("assistant", false)).toBe(false);
    expect(canDeleteNote("secretary", false)).toBe(true);
  });
});

describe("tela de notas", () => {
  function renderAs(profile: Profile, notes: Note[] = []) {
    useAuthStore.setState({ status: "signedIn", profile, error: null });
    render(<NotasApp />);
    // A busca é simulada com falha; o teste entrega as notas direto ao store.
    return waitFor(() => expect(useNoteStore.getState().status).toBe("error")).then(() =>
      useNoteStore.setState({ notes, status: "ready" }),
    );
  }

  beforeEach(() => {
    resetDb();
    api.saved = [];
    api.toggled = [];
    api.failToggle = false;
    window.history.replaceState(null, "", "/notas.html");
    useNoteStore.setState({ notes: [], status: "idle" });
    useTaskStore.setState({ tasks: [], status: "idle" });
    useReminderStore.setState({
      reminders: [{ id: "r1", title: "Enviar memorando", schedule: { kind: "weekly", weekday: 1 }, createdOn: "2026-01-01" }],
      doneKeys: new Set(),
      status: "ready",
    });
    useToastStore.getState().clear();
  });

  it("marca um item e mostra o que ainda falta", async () => {
    const user = userEvent.setup();
    db.tasks = [makeTask({ id: "t1", title: "Festa junina" })];
    await renderAs(ASSISTANT, [makeNote({ link: { type: "task", id: "t1" } })]);

    const card = within((await screen.findByRole("heading", { name: "Ornamentação" })).closest("li") as HTMLElement);
    expect(card.getByText("1 de 2 · falta 1")).toBeInTheDocument();
    expect(await card.findByText("Tarefa: Festa junina")).toBeInTheDocument();
    expect(card.getByLabelText("Balões")).toBeChecked();

    await user.click(card.getByLabelText("Fita adesiva"));
    expect(await card.findByText("Nada faltando")).toBeInTheDocument();
    expect(api.toggled).toEqual([["n1", "b", true]]);
  });

  it("desfaz a marcação quando o banco recusa", async () => {
    const user = userEvent.setup();
    api.failToggle = true;
    await renderAs(ASSISTANT, [makeNote()]);
    await user.click(await screen.findByLabelText("Fita adesiva"));
    expect(await screen.findByText("Não foi possível marcar o item. Tente de novo.")).toBeInTheDocument();
    expect(screen.getByLabelText("Fita adesiva")).not.toBeChecked();
  });

  it("cria uma lista vinculada a um lembrete", async () => {
    const user = userEvent.setup();
    await renderAs(ASSISTANT);

    await user.click(screen.getByRole("button", { name: "Nova nota" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nova nota" }));
    await user.click(dialog.getByRole("button", { name: "Criar nota" }));
    expect(dialog.getByText("Dê um título à nota.")).toBeInTheDocument();

    await user.type(dialog.getByLabelText("Título *"), "Kit do memorando");
    await user.type(dialog.getByLabelText("Itens *"), "Frequência{Enter}Assinatura");
    await user.selectOptions(dialog.getByLabelText("Vincular a"), "reminder:r1");
    await user.click(dialog.getByRole("button", { name: "Criar nota" }));

    expect(await screen.findByRole("heading", { name: "Kit do memorando" })).toBeInTheDocument();
    expect(screen.getByText("Lembrete: Enviar memorando")).toBeInTheDocument();
    expect(api.saved[0]?.input).toMatchObject({
      kind: "checklist",
      items: [
        { text: "Frequência", done: false },
        { text: "Assinatura", done: false },
      ],
      link: { type: "reminder", id: "r1" },
    });
  });

  it("chegando pela tarefa, o formulário já abre vinculado; nota de texto não pede itens", async () => {
    const user = userEvent.setup();
    db.tasks = [makeTask({ id: "t1", title: "Festa junina" })];
    window.history.replaceState(null, "", "/notas.html?tarefa=t1");
    await renderAs(ASSISTANT);

    const dialog = within(await screen.findByRole("dialog", { name: "Nova nota" }));
    await waitFor(() => expect(dialog.getByLabelText("Vincular a")).toHaveDisplayValue("Festa junina"));
    await user.click(dialog.getByLabelText("Texto"));
    await user.type(dialog.getByLabelText("Título *"), "Recado");
    await user.click(dialog.getByRole("button", { name: "Criar nota" }));

    await waitFor(() => expect(api.saved).toHaveLength(1));
    expect(api.saved[0]?.input).toMatchObject({ kind: "text", items: [], link: { type: "task", id: "t1" } });
    expect(window.location.search).toBe("");
  });

  it("o assistente só exclui as próprias notas; o secretário exclui qualquer uma", async () => {
    const notes = [makeNote({ id: "minha", title: "Minha" }), makeNote({ id: "outra", title: "Da Rita", authorId: "sec" })];
    await renderAs(ASSISTANT, notes);
    expect(await screen.findByRole("button", { name: "Excluir Minha" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir Da Rita" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Da Rita" })).toBeInTheDocument();
  });

  it("o secretário exclui a nota de outra pessoa", async () => {
    const user = userEvent.setup();
    await renderAs(SECRETARY, [makeNote({ title: "Da Ana" })]);
    await user.click(await screen.findByRole("button", { name: "Excluir Da Ana" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Excluir nota?" })).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Da Ana" })).not.toBeInTheDocument());
  });
});

describe("notas vinculadas (na tarefa e no lembrete)", () => {
  beforeEach(() => {
    api.toggled = [];
    api.failToggle = false;
    useNoteStore.setState({
      notes: [makeNote({ link: { type: "task", id: "t1" } }), makeNote({ id: "n2", title: "De outra tarefa", link: { type: "task", id: "t2" } })],
      status: "ready",
    });
  });

  it("mostra só as notas daquela tarefa e deixa marcar ali mesmo", async () => {
    const user = userEvent.setup();
    render(<LinkedNotes link={{ type: "task", id: "t1" }} showAdd />);
    const section = within(screen.getByRole("region", { name: "Notas vinculadas" }));
    expect(section.getByText("Ornamentação")).toBeInTheDocument();
    expect(section.queryByText("De outra tarefa")).not.toBeInTheDocument();
    expect(section.getByRole("link", { name: "Nova nota" })).toHaveAttribute("href", "notas.html?tarefa=t1");

    await user.click(section.getByLabelText("Fita adesiva"));
    expect(await section.findByText("2 de 2")).toBeInTheDocument();
  });

  it("sem notas e sem atalho, não ocupa espaço", () => {
    const { container } = render(<LinkedNotes link={{ type: "reminder", id: "r9" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
