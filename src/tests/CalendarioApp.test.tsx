import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));
vi.mock("../store/taskApi", () => import("./fakeTaskApi"));
vi.mock("../store/holidayApi", () => ({
  fetchHolidays: async () => ({ data: [], error: null }),
  saveHoliday: async (_schoolId: string, input: { name: string; start: string; end: string }) => ({
    data: { id: "novo", ...input, source: "school" },
    error: null,
  }),
  removeHoliday: async () => null,
}));

import CalendarioApp from "../calendario/CalendarioApp";
import { useAuthStore } from "../store/authStore";
import { useDirectoryStore } from "../store/directoryStore";
import { useHolidayStore } from "../store/holidayStore";
import { useReminderStore } from "../store/reminderStore";
import { useTaskStore } from "../store/taskStore";
import { useToastStore } from "../store/toastStore";
import type { Profile } from "../types/auth";
import { longDate, monthLabel } from "../utils/calendar";
import { todayISO } from "../utils/date";
import { db, resetDb } from "./fakeTaskApi";
import { ASSISTANT, makeTask, SECRETARY, TEAM } from "./helpers";

const today = todayISO();

function renderAs(profile: Profile) {
  useAuthStore.setState({ status: "signedIn", profile, error: null });
  render(<CalendarioApp />);
  return within(screen.getByRole("region", { name: "Dia escolhido" }));
}

describe("CalendarioApp", () => {
  beforeEach(() => {
    resetDb();
    useTaskStore.setState({ tasks: [], status: "idle" });
    useHolidayStore.setState({ holidays: [], status: "idle" });
    useDirectoryStore.setState({ members: TEAM, schools: [], status: "ready" });
    useToastStore.getState().clear();
    useReminderStore.setState({
      reminders: [{ id: "r1", title: "Enviar memorando", schedule: { kind: "once", dueDate: today }, createdOn: "2026-01-01" }],
      doneKeys: new Set(),
      status: "ready",
    });
  });

  it("abre no mês atual, com as tarefas e os lembretes de hoje", async () => {
    db.tasks = [makeTask({ title: "Emitir históricos", dueDate: today, assignees: ["ana"] })];
    const panel = renderAs(SECRETARY);

    expect(screen.getByRole("heading", { name: monthLabel(today.slice(0, 7)) })).toBeInTheDocument();
    expect(panel.getByRole("heading", { name: longDate(today) })).toBeInTheDocument();
    expect(await panel.findByText("Emitir históricos")).toBeInTheDocument();
    expect(panel.getByText("@Souza")).toBeInTheDocument();
    expect(panel.getByText("Enviar memorando")).toBeInTheDocument();
    expect(panel.getByText("Pendente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(`^${longDate(today)}.*1 tarefa, 1 lembrete`) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("secretário adiciona um feriado no dia escolhido", async () => {
    const user = userEvent.setup();
    const panel = renderAs(SECRETARY);

    await user.click(screen.getByRole("button", { name: "Novo feriado" }));
    const dialog = await screen.findByRole("dialog", { name: "Novo feriado ou recesso" });
    expect(within(dialog).getByLabelText("Dia *")).toHaveValue(today);

    await user.click(within(dialog).getByRole("button", { name: "Adicionar feriado" }));
    expect(within(dialog).getByText("Informe o nome do feriado ou recesso.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Nome *"), "Aniversário da cidade");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar feriado" }));

    expect(await panel.findByText("Aniversário da cidade")).toBeInTheDocument();
    expect(panel.getByText("Da escola")).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Excluir Aniversário da cidade" })).toBeInTheDocument();
  });

  it("auxiliar vê o calendário, mas não cadastra feriados", () => {
    useHolidayStore.setState({
      holidays: [{ id: "h1", name: "Recesso", start: today, end: today, source: "school" }],
      status: "ready",
    });
    const panel = renderAs(ASSISTANT);

    expect(panel.getByText("Recesso")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo feriado" })).not.toBeInTheDocument();
    expect(panel.queryByRole("button", { name: "Feriado neste dia" })).not.toBeInTheDocument();
    expect(panel.queryByRole("button", { name: "Excluir Recesso" })).not.toBeInTheDocument();
  });

  it("navega entre os meses", async () => {
    const user = userEvent.setup();
    renderAs(SECRETARY);
    const month = today.slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${(y ?? 0) + 1}-01` : `${y}-${String((m ?? 0) + 1).padStart(2, "0")}`;

    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByRole("heading", { name: monthLabel(next) })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hoje" }));
    expect(screen.getByRole("heading", { name: monthLabel(month) })).toBeInTheDocument();
  });
});
