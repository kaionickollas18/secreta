import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();

vi.mock("../store/supabaseClient", () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => signInWithPassword(...args) } },
}));

import { LoginPage } from "../components/auth/LoginPage";
import { useAuthStore } from "../store/authStore";

describe("LoginPage", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    useAuthStore.setState({ status: "signedOut", profile: null, error: null });
  });

  it("valida os campos antes de chamar o servidor", async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe o e-mail.");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("mostra mensagem clara quando as credenciais estão erradas", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@escola.com");
    await userEvent.type(screen.getByLabelText("Senha"), "errada123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha incorretos."));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "ana@escola.com", password: "errada123" });
  });
});
