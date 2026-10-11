import { useState, type FormEvent } from "react";
import { useAuthStore } from "../../store/authStore";
import { validateLogin } from "../../utils/authErrors";
import { Button } from "../ui/Button";
import { LoginBackdrop } from "./LoginBackdrop";
import { LoginMovies } from "./LoginMovies";

const FIELD =
  "w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm placeholder:text-muted/70 aria-[invalid=true]:border-prio-urgent";

export function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn);
  const serverError = useAuthStore((s) => s.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const error = localError ?? serverError;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validateLogin(email, password);
    setLocalError(problem);
    if (problem) return;
    setSubmitting(true);
    await signIn(email, password);
    setSubmitting(false);
  }

  return (
    <>
      <LoginBackdrop />
      <main>
        {/* O login ocupa a primeira tela inteira; os destaques ficam logo abaixo, ao rolar. */}
        <div className="mx-auto flex min-h-[100svh] max-w-md flex-col justify-center px-4 py-8">
          <h1 className="page-title text-center">SECRETA</h1>
          <p className="mb-6 mt-1 text-center text-sm text-muted">
            Entre com seu e-mail e senha.
          </p>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="glass space-y-4 rounded-3xl p-5"
          >
            <div>
              <label htmlFor="login-email" className="mb-1 block text-sm font-medium">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                data-autofocus
                className={FIELD}
                value={email}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1 block text-sm font-medium">
                Senha
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                className={FIELD}
                value={password}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p id="login-error" role="alert" className="text-sm text-prio-urgent">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>
        <LoginMovies />
      </main>
    </>
  );
}
