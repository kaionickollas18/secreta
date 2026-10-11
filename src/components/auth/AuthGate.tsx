import { useEffect, type ReactNode } from "react";
import { supabaseConfigured, useAuthStore } from "../../store/authStore";
import type { UserRole } from "../../types/auth";
import { ROLE_LABELS } from "../../utils/roles";
import { Button } from "../ui/Button";
import { LoginPage } from "./LoginPage";

interface AuthGateProps {
  /** Perfis que podem ver esta página. */
  allow: readonly UserRole[];
  /** Perfis que devem ser levados a outra página (ex.: o Master vai para a gestão). */
  redirects?: Partial<Record<UserRole, string>>;
  children: ReactNode;
}

function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

/** Mostra o login quando não há sessão e bloqueia perfis sem permissão para a página. */
export function AuthGate({ allow, redirects, children }: AuthGateProps) {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const init = useAuthStore((s) => s.init);
  const signOut = useAuthStore((s) => s.signOut);
  const redirectTo = profile ? redirects?.[profile.role] : undefined;

  useEffect(() => init(), [init]);
  useEffect(() => {
    if (redirectTo) window.location.replace(redirectTo);
  }, [redirectTo]);

  if (!supabaseConfigured) {
    return (
      <Message title="Configuração ausente">
        <p className="text-sm text-muted">
          O sistema não encontrou as chaves do Supabase. Verifique o arquivo .env e gere o site novamente.
        </p>
      </Message>
    );
  }

  if (status === "loading") {
    return (
      <Message title="Carregando…">
        <p role="status" className="sr-only">
          Verificando sua sessão
        </p>
      </Message>
    );
  }

  if (status === "signedOut" || !profile) return <LoginPage />;

  if (redirectTo) return <Message title="Redirecionando…" />;

  if (!allow.includes(profile.role)) {
    return (
      <Message title="Sem acesso a esta página">
        <p className="text-sm text-muted">Seu perfil ({ROLE_LABELS[profile.role]}) não usa esta página.</p>
        <Button variant="secondary" onClick={() => void signOut()}>
          Sair
        </Button>
      </Message>
    );
  }

  return <>{children}</>;
}
