import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { LockIcon } from "../ui/Icons";

interface UnlockPanelProps {
  /** A pessoa já tem chave no banco; senão, a senha vai criar a primeira. */
  hasKey: boolean;
  /** Cada ação devolve a mensagem de erro, ou `null` se deu certo. */
  onUnlock: (password: string) => Promise<string | null>;
  onReset: (password: string) => Promise<string | null>;
}

/**
 * Pede a senha da conta para abrir as conversas protegidas neste aparelho. A chave que abre
 * as mensagens é guardada embaralhada com essa senha, então sem ela nada é lido.
 */
export function UnlockPanel({ hasKey, onUnlock, onReset }: UnlockPanelProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function run(action: (password: string) => Promise<string | null>) {
    if (password === "") {
      setError("Digite a sua senha.");
      return;
    }
    setBusy(true);
    setError(await action(password));
    setBusy(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void run(onUnlock);
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-sm space-y-3 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-light">
          <LockIcon />
        </span>
        <h3 className="section-title">{hasKey ? "Abrir conversas protegidas" : "Ativar conversas protegidas"}</h3>
        <p className="caption mx-auto">
          As conversas entre duas pessoas são embaralhadas no seu aparelho: só você e o colega conseguem ler, nem
          quem cuida do sistema. Digite a senha da sua conta para {hasKey ? "abri-las" : "ativá-las"} aqui.
        </p>
        <div className="text-left">
          <label htmlFor="chat-password" className="mb-1 block text-sm font-medium">
            Sua senha
          </label>
          <input
            id="chat-password"
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "chat-password-error" : undefined}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-canvas/70 px-3 py-2 text-sm aria-[invalid=true]:border-prio-urgent"
          />
          {error && (
            <p id="chat-password-error" role="alert" className="mt-1 text-sm text-prio-urgent">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" variant="primary" disabled={busy} className="w-full">
          {busy ? "Abrindo…" : hasKey ? "Abrir conversas" : "Ativar conversas"}
        </Button>
        {hasKey && (
          <Button variant="ghost" disabled={busy} className="w-full" onClick={() => setConfirmReset(true)}>
            Minha senha foi redefinida: recomeçar
          </Button>
        )}
      </form>

      <ConfirmDialog
        open={confirmReset}
        title="Recomeçar as conversas protegidas?"
        message="Use isto só se a sua senha foi redefinida e a atual não abre as conversas. Você deixa de conseguir ler as mensagens antigas (os colegas continuam lendo as deles). As novas funcionam normalmente."
        confirmLabel="Recomeçar"
        onConfirm={() => {
          setConfirmReset(false);
          void run(onReset);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
