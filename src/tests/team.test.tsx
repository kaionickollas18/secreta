import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TeamSection } from "../components/profile/TeamSection";
import { ageOn, displayName, schoolTeam } from "../utils/directory";
import { validatePersonalDetails } from "../utils/profileForm";
import { openTasksOf } from "../utils/tasks";
import { makeMember, makeTask, TEAM } from "./helpers";

describe("perfil das pessoas (regras)", () => {
  it("lista só a equipe da escola: secretário, ativos e depois inativos", () => {
    const members = [
      makeMember({ id: "zeca", fullName: "Zeca Alves", active: false }),
      ...TEAM,
      makeMember({ id: "fora", fullName: "Outra Escola", schoolId: "school-2" }),
      makeMember({ id: "m", fullName: "Kaio Ribeiro", role: "master", schoolId: null }),
    ];
    expect(schoolTeam(members, "school-1").map((m) => m.id)).toEqual(["sec", "ana", "beto", "zeca"]);
  });

  it("usa o apelido quando existe e calcula a idade em anos completos", () => {
    expect(displayName({ fullName: "Ana Souza", nickname: "Aninha" })).toBe("Aninha");
    expect(displayName({ fullName: "Ana Souza" })).toBe("Ana Souza");
    expect(ageOn("1990-10-14", "2026-10-13")).toBe(35);
    expect(ageOn("1990-10-13", "2026-10-13")).toBe(36);
  });

  it("valida apelido e nascimento, ambos opcionais", () => {
    const today = "2026-10-13";
    expect(validatePersonalDetails({ nickname: "  Aninha  ", birthDate: "1990-03-15" }, today)).toEqual({
      valid: true,
      value: { nickname: "Aninha", birthDate: "1990-03-15" },
    });
    expect(validatePersonalDetails({ nickname: "", birthDate: "" }, today)).toEqual({
      valid: true,
      value: { nickname: null, birthDate: null },
    });
    // As letras ficam como foram escritas; só espaços repetidos viram um.
    expect(validatePersonalDetails({ nickname: "Amigo  da   Escola", birthDate: "" }, today)).toMatchObject({
      value: { nickname: "Amigo da Escola" },
    });
    const errorsOf = (form: { nickname: string; birthDate: string }) => {
      const result = validatePersonalDetails(form, today);
      return result.valid ? {} : result.errors;
    };
    expect(errorsOf({ nickname: "x".repeat(31), birthDate: "" }).nickname).toBeDefined();
    expect(errorsOf({ nickname: "", birthDate: "2026-10-14" }).birthDate).toContain("futuro");
    expect(errorsOf({ nickname: "", birthDate: "1890-01-01" }).birthDate).toBeDefined();
    expect(errorsOf({ nickname: "", birthDate: "1990-02-30" }).birthDate).toBeDefined();
  });

  it("tarefas em aberto de uma pessoa não incluem as concluídas nem as dos outros", () => {
    const mine = makeTask({ id: "a", assignees: ["ana"] });
    const tasks = [mine, makeTask({ assignees: ["ana"], status: "done" }), makeTask({ assignees: ["beto"] })];
    expect(openTasksOf(tasks, "ana")).toEqual([mine]);
  });
});

describe("pessoas da escola (tela)", () => {
  const members = [
    TEAM[0],
    makeMember({ id: "ana", fullName: "Ana Souza", nickname: "Aninha", birthDate: "1990-03-15" }),
    makeMember({ id: "beto", fullName: "Beto Dias" }),
  ].flatMap((m) => (m ? [m] : []));
  const tasks = [
    makeTask({ title: "Emitir históricos", assignees: ["ana"], dueDate: "2026-10-20", priority: "high" }),
    makeTask({ title: "Já feita", assignees: ["ana"], status: "done" }),
  ];

  it("abre o perfil com apelido, nascimento, e-mail e tarefas em aberto", async () => {
    const user = userEvent.setup();
    render(<TeamSection members={members} schoolId="school-1" currentUserId="sec" tasks={tasks} />);

    expect(screen.getByRole("button", { name: "Ver perfil de Rita Lopes" })).toHaveTextContent("(você)");
    await user.click(screen.getByRole("button", { name: "Ver perfil de Ana Souza" }));

    const dialog = within(await screen.findByRole("dialog", { name: "Perfil de Aninha" }));
    expect(dialog.getByText("Ana Souza")).toBeInTheDocument();
    expect(dialog.getByText("Auxiliar Administrativo")).toBeInTheDocument();
    expect(dialog.getByText("15/03/1990")).toBeInTheDocument();
    expect(dialog.getByRole("link", { name: "ana@escola.com" })).toHaveAttribute("href", "mailto:ana@escola.com");
    expect(dialog.getByText("Emitir históricos")).toBeInTheDocument();
    expect(dialog.queryByText("Já feita")).not.toBeInTheDocument();
  });

  it("mostra o que a pessoa ainda não informou", async () => {
    const user = userEvent.setup();
    render(<TeamSection members={members} schoolId="school-1" currentUserId="sec" tasks={[]} />);
    await user.click(screen.getByRole("button", { name: "Ver perfil de Beto Dias" }));

    const dialog = within(await screen.findByRole("dialog", { name: "Perfil de Beto Dias" }));
    expect(dialog.getAllByText("Não informado")).toHaveLength(2);
    expect(dialog.getByText("Nenhuma tarefa em aberto.")).toBeInTheDocument();
  });

  it("do perfil de um colega dá para começar a conversa; no próprio perfil, não", async () => {
    const user = userEvent.setup();
    const onStartChat = vi.fn();
    render(<TeamSection members={members} schoolId="school-1" currentUserId="sec" tasks={[]} onStartChat={onStartChat} />);

    await user.click(screen.getByRole("button", { name: "Ver perfil de Ana Souza" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Conversar com Souza" }));
    expect(onStartChat).toHaveBeenCalledWith(expect.objectContaining({ id: "ana" }));

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Ver perfil de Rita Lopes" }));
    expect(within(await screen.findByRole("dialog")).queryByRole("button", { name: /Conversar/ })).not.toBeInTheDocument();
  });
});
