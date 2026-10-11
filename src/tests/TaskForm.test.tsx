import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));

import { TaskForm } from "../components/task/TaskForm";
import { useAuthStore } from "../store/authStore";
import { useDirectoryStore } from "../store/directoryStore";
import { ASSISTANT, makeTask, SECRETARY, TEAM } from "./helpers";

describe("TaskForm", () => {
  beforeEach(() => {
    useDirectoryStore.setState({ members: TEAM, schools: [], status: "ready" });
    useAuthStore.setState({ status: "signedIn", profile: SECRETARY, error: null });
  });

  it("mostra erro e não envia quando o título está vazio", async () => {
    const onSubmit = vi.fn();
    render(<TaskForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um título");
    expect(screen.getByLabelText(/título/i)).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("envia os dados normalizados com os responsáveis do cadastro", async () => {
    const onSubmit = vi.fn();
    render(<TaskForm defaultStatus="review" onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText(/título/i), "  Planejar sprint ");
    await userEvent.selectOptions(screen.getByLabelText("Prioridade"), "high");
    await userEvent.click(screen.getByLabelText("@Lopes"));
    await userEvent.click(screen.getByLabelText("@Souza"));
    await userEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Planejar sprint",
      description: undefined,
      status: "review",
      priority: "high",
      assignees: ["sec", "ana"],
      dueDate: undefined,
    });
  });

  it("lista o secretário primeiro e não oferece Concluído em tarefa nova", () => {
    render(<TaskForm onSubmit={() => {}} onCancel={() => {}} />);
    const names = screen.getAllByRole("checkbox").map((box) => box.parentElement?.textContent);
    expect(names).toEqual(["@Lopes", "@Dias", "@Souza"]);
    expect(screen.queryByRole("option", { name: "Concluído" })).not.toBeInTheDocument();
  });

  it("o auxiliar não escolhe responsáveis nem Concluído", () => {
    useAuthStore.setState({ profile: ASSISTANT });
    render(
      <TaskForm task={makeTask({ assignees: ["beto"] })} onSubmit={() => {}} onCancel={() => {}} />,
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("@Dias")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Concluído" })).not.toBeInTheDocument();
  });
});
