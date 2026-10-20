import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));

import { AppShell } from "../components/layout/AppShell";
import { useAuthStore } from "../store/authStore";
import { useMessageStore } from "../store/messageStore";
import { useReminderStore } from "../store/reminderStore";
import type { Profile } from "../types/auth";
import { todayISO } from "../utils/date";
import { NAV_PREFERENCE_KEY, parseNavCollapsed } from "../utils/navPreference";
import { ASSISTANT, SECRETARY, TEACHER } from "./helpers";

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
  // O rótulo visível de cada item da lista (sem o ícone, o avatar nem o contador).
  within(within(nav).getByRole("list"))
    .getAllByRole("link")
    .map((link) => link.querySelector("span.truncate")?.textContent);

describe("AppShell", () => {
  beforeEach(() => {
    useReminderStore.setState({ reminders: [], doneKeys: new Set(), status: "idle" });
    useMessageStore.setState({ messages: [], status: "idle", lastSeen: null });
  });

  it("secretário vê todas as áreas, com a página atual marcada", () => {
    const nav = within(renderShell(SECRETARY, "dashboard"));
    expect(linkNames(screen.getByRole("navigation"))).toEqual(["Quadro", "Lembretes", "Calendário", "Notas", "Documentos", "Conversas", "Dashboard", "Equipe", "Perfil"]);
    expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Quadro" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("auxiliar não vê Equipe; Master só vê Escolas", () => {
    expect(linkNames(renderShell(ASSISTANT))).toEqual(["Quadro", "Lembretes", "Calendário", "Notas", "Documentos", "Conversas", "Dashboard", "Perfil"]);
    cleanup();
    // Mesmo com acesso de secretário, o auxiliar não gerencia a equipe.
    expect(linkNames(renderShell({ ...ASSISTANT, elevated: true }))).toEqual([
      "Quadro",
      "Lembretes",
      "Calendário",
      "Notas",
      "Documentos",
      "Conversas",
      "Dashboard",
      "Perfil",
    ]);
    cleanup();
    expect(linkNames(renderShell(MASTER, "gestao"))).toEqual(["Escolas", "Perfil"]);
  });

  it("professor vê só Conversas, Calendário, Dashboard e Perfil, e não carrega lembretes", () => {
    const original = useReminderStore.getState().load;
    const load = vi.fn(async () => {});
    useReminderStore.setState({ load });
    expect(linkNames(renderShell(TEACHER, "mensagens"))).toEqual(["Conversas", "Calendário", "Dashboard", "Perfil"]);
    expect(load).not.toHaveBeenCalled();
    useReminderStore.setState({ load: original });
  });

  it("o topo do menu mostra quem está usando e leva ao perfil", () => {
    const nav = within(renderShell(SECRETARY, "perfil"));
    const link = nav.getByRole("link", { name: "Meu perfil: Rita Lopes, Secretário" });
    expect(link).toHaveAttribute("href", "perfil.html");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(within(link).getByText("Lopes")).toBeInTheDocument();
  });

  it("retrai e estende o menu, lembrando a escolha", async () => {
    const nav = within(renderShell(SECRETARY));
    const retract = nav.getByRole("button", { name: "Retrair o menu" });
    expect(retract).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(retract);
    const extend = nav.getByRole("button", { name: "Estender o menu" });
    expect(extend).toHaveAttribute("aria-expanded", "false");
    expect(window.localStorage.getItem(NAV_PREFERENCE_KEY)).toBe("retraido");
    // Retraído, os itens continuam com nome (para leitor de tela) e ganham dica ao passar o mouse.
    expect(nav.getByRole("link", { name: "Quadro" })).toHaveAttribute("title", "Quadro");

    // Uma página aberta depois já começa retraída.
    cleanup();
    expect(
      within(renderShell(SECRETARY)).getByRole("button", { name: "Estender o menu" }),
    ).toBeInTheDocument();
  });

  it("começa estendido quando não há escolha guardada ou ela é inválida", () => {
    expect(parseNavCollapsed(null)).toBe(false);
    expect(parseNavCollapsed("qualquer coisa")).toBe(false);
    expect(parseNavCollapsed("retraido")).toBe(true);
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
    expect(nav.getByRole("link", { name: /Conversas.*1 mensagem nova/ })).toBeInTheDocument();
  });
});
