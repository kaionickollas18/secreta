import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));
vi.mock("../store/taskApi", () => import("./fakeTaskApi"));

import App from "../App";
import { useAuthStore } from "../store/authStore";
import { useDirectoryStore } from "../store/directoryStore";
import { useFilterStore } from "../store/filterStore";
import { useTaskStore } from "../store/taskStore";
import { useToastStore } from "../store/toastStore";
import type { Profile } from "../types/auth";
import { todayISO } from "../utils/date";
import { db, resetDb } from "./fakeTaskApi";
import { ASSISTANT, makeTask, SECRETARY, TEAM } from "./helpers";

function signInAs(profile: Profile) {
  useAuthStore.setState({ status: "signedIn", profile, error: null });
}

describe("App", () => {
  beforeEach(() => {
    resetDb();
    useTaskStore.setState({ tasks: [], status: "idle" });
    useDirectoryStore.setState({ members: TEAM, schools: [], status: "ready" });
    useFilterStore.getState().clear();
    useToastStore.getState().clear();
    signInAs(SECRETARY);
  });

  it("mostra estados vazios úteis nas colunas", async () => {
    render(<App />);
    expect(await screen.findAllByText("Nenhuma tarefa")).toHaveLength(4);
    expect(screen.getByText("Crie sua primeira tarefa para começar.")).toBeInTheDocument();
  });

  it("secretário cria uma tarefa com responsável vindo do cadastro", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova tarefa" });
    await user.type(within(dialog).getByLabelText(/título/i), "Emitir históricos");
    await user.click(within(dialog).getByLabelText("@Souza"));
    await user.click(within(dialog).getByRole("button", { name: "Criar tarefa" }));

    const card = (await screen.findByRole("heading", { name: "Emitir históricos", level: 3 })).closest(
      "article",
    );
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("@Souza")).toBeInTheDocument();
    expect(db.tasks[0]?.assignees).toEqual(["ana"]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("edita uma tarefa e muda a prioridade no cartão", async () => {
    const user = userEvent.setup();
    db.tasks = [makeTask({ id: "t1", title: "Rascunho" })];
    render(<App />);

    await user.selectOptions(await screen.findByLabelText("Prioridade de Rascunho"), "urgent");
    await waitFor(() => expect(db.tasks[0]?.priority).toBe("urgent"));

    await user.click(screen.getByRole("button", { name: "Editar Rascunho" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar tarefa" });
    const title = within(dialog).getByLabelText(/título/i);
    await user.clear(title);
    await user.type(title, "Versão final");
    await user.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByRole("heading", { name: "Versão final" })).toBeInTheDocument();
  });

  it("busca por título e por sobrenome do responsável", async () => {
    const user = userEvent.setup();
    db.tasks = [
      makeTask({ title: "Comprar café", assignees: ["beto"] }),
      makeTask({ title: "Revisar contrato", priority: "high" }),
    ];
    render(<App />);
    await screen.findByRole("heading", { name: "Comprar café" });

    await user.type(screen.getByLabelText("Buscar tarefas"), "contrato");
    expect(screen.getByRole("heading", { name: "Revisar contrato" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Comprar café" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await user.type(screen.getByLabelText("Buscar tarefas"), "dias");
    expect(screen.getByRole("heading", { name: "Comprar café" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Revisar contrato" })).not.toBeInTheDocument();
  });

  it("confirma a exclusão antes de remover", async () => {
    const user = userEvent.setup();
    db.tasks = [makeTask({ title: "Descartável" }), makeTask({ title: "Manter" })];
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Excluir Manter" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("heading", { name: "Manter" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Excluir Descartável" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir tarefa?" });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Descartável" })).not.toBeInTheDocument(),
    );
    expect(db.tasks.map((t) => t.title)).toEqual(["Manter"]);
  });

  it("auxiliar não cria nem exclui, e pede a conclusão", async () => {
    const user = userEvent.setup();
    signInAs(ASSISTANT);
    db.tasks = [makeTask({ id: "t1", title: "Arquivar pastas", status: "in_progress" })];
    render(<App />);
    await screen.findByRole("heading", { name: "Arquivar pastas" });

    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Adicionar tarefa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir Arquivar pastas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Equipe" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pedir conclusão de Arquivar pastas" }));
    expect(await screen.findByText("Aguardando aprovação")).toBeInTheDocument();
    expect(db.tasks[0]).toMatchObject({ status: "review", completionRequested: true });
    expect(screen.queryByRole("button", { name: /^Aprovar/ })).not.toBeInTheDocument();
  });

  it("auxiliar com acesso de secretário cria, exclui e aprova", async () => {
    const user = userEvent.setup();
    signInAs({ ...ASSISTANT, elevated: true });
    db.tasks = [makeTask({ id: "t1", title: "Arquivar pastas", status: "review", completionRequested: true })];
    render(<App />);
    await screen.findByRole("heading", { name: "Arquivar pastas" });

    expect(screen.getByRole("button", { name: "Nova tarefa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir Arquivar pastas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pedir conclusão/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Aprovar conclusão de Arquivar pastas" }));
    await waitFor(() => expect(db.tasks[0]).toMatchObject({ status: "done", completionRequested: false }));
  });

  it("secretário vê o pedido e aprova a conclusão", async () => {
    const user = userEvent.setup();
    db.tasks = [makeTask({ id: "t1", title: "Arquivar pastas", status: "review", completionRequested: true })];
    render(<App />);

    expect(await screen.findByText(/1 aguardando sua aprovação/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aprovar conclusão de Arquivar pastas" }));
    await waitFor(() => expect(db.tasks[0]).toMatchObject({ status: "done", completionRequested: false }));
    await waitFor(() => expect(screen.queryByText("Aguardando aprovação")).not.toBeInTheDocument());
  });

  it("avisa o responsável sobre as tarefas dele que vencem hoje ou atrasaram", async () => {
    const user = userEvent.setup();
    db.tasks = [
      makeTask({ title: "Minha de hoje", assignees: ["sec"], dueDate: todayISO() }),
      makeTask({ title: "Minha atrasada", assignees: ["sec", "ana"], dueDate: "2020-01-01" }),
      makeTask({ title: "De outra pessoa", assignees: ["beto"], dueDate: "2020-01-01" }),
    ];
    render(<App />);

    const notices = within(await screen.findByRole("region", { name: "Avisos" }));
    expect(notices.getByText("1 atrasada · 1 vence hoje")).toBeInTheDocument();

    await user.click(notices.getByRole("button", { name: "Ver minhas" }));
    expect(screen.getByRole("heading", { name: "Minha de hoje" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "De outra pessoa" })).not.toBeInTheDocument();
  });

  it("sem tarefas para avisar, a faixa de avisos não aparece", async () => {
    db.tasks = [makeTask({ title: "De outra pessoa", assignees: ["beto"], dueDate: "2020-01-01" })];
    render(<App />);
    await screen.findByRole("heading", { name: "De outra pessoa" });
    expect(screen.queryByRole("region", { name: "Avisos" })).not.toBeInTheDocument();
  });

  it("mostra o histórico de concluídas com opção de baixar", async () => {
    const user = userEvent.setup();
    db.history = [
      {
        id: "h1",
        title: "Matrículas 2026",
        priority: "high",
        assigneeNames: ["Ana Souza"],
        taskCreatedAt: "2026-01-10T10:00:00.000Z",
        completedAt: "2026-01-20T15:30:00.000Z",
        completedByName: "Rita Lopes",
      },
    ];
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Histórico" }));
    const dialog = await screen.findByRole("dialog", { name: "Histórico de tarefas concluídas" });
    expect(await within(dialog).findByText("Matrículas 2026")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Período do histórico")).toHaveValue("30");
    expect(within(dialog).getByRole("button", { name: "Baixar planilha (CSV)" })).toBeEnabled();
  });
});
