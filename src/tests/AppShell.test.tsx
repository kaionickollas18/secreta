import { cleanup, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));

import { AppShell } from "../components/layout/AppShell";
import { useAuthStore } from "../store/authStore";
import { useMessageStore } from "../store/messageStore";
import { useReminderStore } from "../store/reminderStore";
import type { Profile } from "../types/auth";
import { todayISO } from "../utils/date";
import { ASSISTANT, SECRETARY } from "./helpers";

const MASTER: Profile = { id: "m", role: "master", schoolId: null, fullName: "Kaio Ribeiro", lastName: "Ribeiro" };

function renderShell(profile: Profile, active: Parameters<typeof AppShell>[0]["active"] = "quadro") {
  useAuthStore.setState({ status: "signedIn", profile, error: null });
  render(
    <AppShell active={active}>
      <p>conteúdo</p>
    </AppShell>,
  );
  return screen.getByRole("navigation", { name: "Navegação principal" });
}

const linkNames = (nav: HTMLElement) =>
  within(nav).getAllByRole("link").map((link) => link.textContent?.replace(/\d+|\(.*\)/g, "").trim());

describe("AppShell", () => {
  beforeEach(() => {
    useReminderStore.setState({ reminders: [], doneKeys: new Set(), status: "idle" });
    useMessageStore.setState({ messages: [], status: "idle", lastSeen: null });
  });

  it("secretário vê todas as áreas, com a página atual marcada", () => {
    const nav = within(renderShell(SECRETARY, "dashboard"));
    expect(linkNames(screen.getByRole("navigation"))).toEqual(["Quadro", "Lembretes", "Mensagens", "Dashboard", "Equipe"]);
    expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Quadro" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("auxiliar não vê Equipe; Master só vê Escolas", () => {
    expect(linkNames(renderShell(ASSISTANT))).toEqual(["Quadro", "Lembretes", "Mensagens", "Dashboard"]);
    cleanup();
    expect(linkNames(renderShell(MASTER, "gestao"))).toEqual(["Escolas"]);
  });

  it("avisa sobre lembretes que pedem atenção e mensagens novas", () => {
    useReminderStore.setState({
      reminders: [
        { id: "r1", title: "Hoje", schedule: { kind: "once", dueDate: todayISO() }, createdOn: "2026-01-01" },
      ],
    });
    useMessageStore.setState({
      messages: [
        { id: "m1", senderId: "ana", senderName: "Ana Souza", body: "Oi", createdAt: new Date().toISOString() },
        { id: "m2", senderId: "sec", senderName: "Rita Lopes", body: "Olá", createdAt: new Date().toISOString() },
      ],
    });
    const nav = within(renderShell(SECRETARY));
    expect(nav.getByRole("link", { name: /Lembretes.*1 lembrete pede atenção/ })).toBeInTheDocument();
    expect(nav.getByRole("link", { name: /Mensagens.*1 mensagem nova/ })).toBeInTheDocument();
  });
});
