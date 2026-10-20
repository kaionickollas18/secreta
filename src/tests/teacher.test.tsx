import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/supabaseClient", () => ({ supabase: null }));

import { TeamPanel } from "../components/admin/TeamPanel";
import { MessageComposer } from "../components/chat/MessageComposer";
import { TeamSection } from "../components/profile/TeamSection";
import { useDirectoryStore } from "../store/directoryStore";
import { managedMembers, schoolTeam } from "../utils/directory";
import { mentionsOutside, type MentionOption } from "../utils/mentions";
import { validateStaffProfile } from "../utils/profileForm";
import { makeMember, makeTask, TEAM } from "./helpers";

const PROF = makeMember({ id: "caio", fullName: "Caio Mendes", role: "teacher" });

describe("professor e equipe (regras)", () => {
  it("o professor aparece entre as pessoas da escola, depois da secretaria", () => {
    const members = [PROF, ...TEAM, makeMember({ id: "zeca", fullName: "Zeca Alves", active: false })];
    expect(schoolTeam(members, "school-1").map((m) => m.id)).toEqual(["sec", "ana", "beto", "caio", "zeca"]);
  });

  it("o secretário gerencia auxiliares e professores, mas não a si mesmo", () => {
    expect(managedMembers([PROF, ...TEAM]).map((m) => m.id)).toEqual(["ana", "beto", "caio"]);
  });

  it("valida o perfil editado pelo secretário", () => {
    const ok = { lastName: "Souza", nickname: "", birthDate: "1990-03-15", email: "ana@escola.com" };
    expect(validateStaffProfile(ok, "2026-10-20")).toEqual({ valid: true, errors: {} });
    const bad = validateStaffProfile({ lastName: " ", nickname: "", birthDate: "2030-01-01", email: "ana" }, "2026-10-20");
    expect(bad.valid).toBe(false);
    expect(Object.keys(bad.errors).sort()).toEqual(["birthDate", "email", "lastName"]);
  });

  it("numa conversa direta, avisa quem foi marcado e não participa", () => {
    const picks: MentionOption[] = [
      { kind: "user", id: "ana", label: "Souza" },
      { kind: "user", id: "beto", label: "Dias" },
      { kind: "task", id: "t1", label: "Pagar boleto" },
    ];
    const text = "@Souza e @Dias, vejam #Pagar boleto";
    expect(mentionsOutside(text, picks, ["sec", "ana"]).map((p) => p.id)).toEqual(["beto"]);
    // No Geral e no Anônimo todos leem: ninguém fica de fora.
    expect(mentionsOutside(text, picks)).toEqual([]);
    // Marcação apagada do texto não gera aviso.
    expect(mentionsOutside("só @Souza", picks, ["sec", "ana"])).toEqual([]);
  });
});

describe("professor e equipe (tela)", () => {
  it("o aviso aparece ao marcar alguém de fora da conversa direta", async () => {
    const user = userEvent.setup();
    const options: MentionOption[] = [
      { kind: "user", id: "ana", label: "Souza" },
      { kind: "user", id: "beto", label: "Dias" },
    ];
    render(<MessageComposer placeholder="Mensagem" mentionOptions={options} audience={["sec", "ana"]} onSend={async () => null} />);
    const field = screen.getByLabelText("Escrever mensagem");

    await user.type(field, "@So");
    await user.keyboard("{Enter}");
    expect(screen.queryByText(/não participa/)).not.toBeInTheDocument();

    await user.type(field, "@Di");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Dias não participa desta conversa e não vai ver esta mensagem.");
  });

  it("para o professor, o perfil dos colegas não mostra tarefas", async () => {
    const user = userEvent.setup();
    render(
      <TeamSection
        members={[...TEAM, PROF]}
        schoolId="school-1"
        currentUserId="caio"
        tasks={[makeTask({ title: "Emitir históricos", assignees: ["ana"] })]}
        showTasks={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Ver perfil de Caio Mendes" })).toHaveTextContent("Professor(a)");
    await user.click(screen.getByRole("button", { name: "Ver perfil de Ana Souza" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Perfil de Ana Souza" }));
    expect(dialog.queryByText(/Tarefas em aberto/)).not.toBeInTheDocument();
  });

  describe("Equipe do secretário", () => {
    const createMember = vi.fn(async () => null);
    const updateMember = vi.fn(async () => null);

    beforeEach(() => {
      createMember.mockClear();
      updateMember.mockClear();
      useDirectoryStore.setState({
        members: [...TEAM, { ...PROF, nickname: "Prof. Caio", birthDate: "1985-05-02", avatarUrl: "https://exemplo/foto.webp" }],
        schools: [],
        status: "ready",
        load: async () => {},
        createMember,
        updateMember,
      });
    });

    it("lista auxiliares e professores com o papel de cada um", () => {
      render(<TeamPanel />);
      const items = screen.getAllByRole("listitem");
      expect(items.map((li) => within(li).getByRole("heading").textContent)).toEqual(["Ana Souza", "Beto Dias", "Caio Mendes"]);
      expect(within(items[2] as HTMLElement).getByText("Professor(a)")).toBeInTheDocument();
      // Acesso de secretário é só para auxiliar.
      expect(within(items[2] as HTMLElement).queryByRole("button", { name: /acesso de secretário/ })).not.toBeInTheDocument();
      expect(within(items[0] as HTMLElement).getByRole("button", { name: /Dar acesso de secretário/ })).toBeInTheDocument();
    });

    it("cadastra um professor", async () => {
      const user = userEvent.setup();
      render(<TeamPanel />);
      await user.click(screen.getByRole("button", { name: "Nova pessoa" }));
      const dialog = within(await screen.findByRole("dialog", { name: "Nova pessoa" }));
      await user.click(dialog.getByRole("radio", { name: "Professor(a)" }));
      await user.type(dialog.getByLabelText("Nome completo *"), "Lia Prado");
      await user.type(dialog.getByLabelText("E-mail *"), "lia@escola.com");
      await user.type(dialog.getByLabelText("Senha inicial *"), "senha-forte-1");
      await user.click(dialog.getByRole("button", { name: "Cadastrar" }));
      await waitFor(() =>
        expect(createMember).toHaveBeenCalledWith({
          fullName: "Lia Prado",
          email: "lia@escola.com",
          password: "senha-forte-1",
          role: "teacher",
        }),
      );
    });

    it("edita livremente o perfil: papel, nome, sobrenome, apelido, nascimento, e-mail e foto", async () => {
      const user = userEvent.setup();
      render(<TeamPanel />);
      await user.click(screen.getByRole("button", { name: "Editar Caio Mendes" }));
      const dialog = within(await screen.findByRole("dialog", { name: "Editar Caio Mendes" }));

      expect(dialog.getByLabelText("Apelido")).toHaveValue("Prof. Caio");
      expect(dialog.getByLabelText("Data de nascimento")).toHaveValue("1985-05-02");
      // O sobrenome acompanha o nome completo enquanto não for mexido.
      await user.clear(dialog.getByLabelText("Nome completo *"));
      await user.type(dialog.getByLabelText("Nome completo *"), "Caio Mendes Rocha");
      expect(dialog.getByLabelText("Sobrenome *")).toHaveValue("Rocha");

      await user.click(dialog.getByRole("radio", { name: "Auxiliar Administrativo" }));
      await user.clear(dialog.getByLabelText("Apelido"));
      await user.clear(dialog.getByLabelText("E-mail *"));
      await user.type(dialog.getByLabelText("E-mail *"), "caio.rocha@escola.com");
      await user.click(dialog.getByRole("checkbox", { name: "Remover a foto de perfil" }));
      await user.click(dialog.getByRole("button", { name: "Salvar" }));

      await waitFor(() =>
        expect(updateMember).toHaveBeenCalledWith("caio", {
          fullName: "Caio Mendes Rocha",
          lastName: "Rocha",
          nickname: "",
          birthDate: "1985-05-02",
          email: "caio.rocha@escola.com",
          role: "assistant",
          password: "",
          active: true,
          removePhoto: true,
        }),
      );
    });

    it("não salva com e-mail inválido ou sobrenome vazio", async () => {
      const user = userEvent.setup();
      render(<TeamPanel />);
      await user.click(screen.getByRole("button", { name: "Editar Ana Souza" }));
      const dialog = within(await screen.findByRole("dialog", { name: "Editar Ana Souza" }));
      await user.clear(dialog.getByLabelText("Sobrenome *"));
      await user.clear(dialog.getByLabelText("E-mail *"));
      await user.type(dialog.getByLabelText("E-mail *"), "ana");
      await user.click(dialog.getByRole("button", { name: "Salvar" }));
      expect(await dialog.findByText("Informe o sobrenome.")).toBeInTheDocument();
      expect(dialog.getByText("Informe um e-mail válido.")).toBeInTheDocument();
      expect(updateMember).not.toHaveBeenCalled();
    });
  });
});
