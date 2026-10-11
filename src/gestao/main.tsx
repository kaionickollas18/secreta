import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { AuthGate } from "../components/auth/AuthGate";
import { AppShell } from "../components/layout/AppShell";
import "../index.css";
import GestaoApp from "./GestaoApp";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado.");

// Desenha já no primeiro quadro: a transição entre páginas fotografa a tela nesse instante.
const app = createRoot(root);
flushSync(() => app.render(
  <StrictMode>
    <AuthGate allow={["master", "secretary"]}>
      <AppShell active="gestao">
        <GestaoApp />
      </AppShell>
    </AuthGate>
  </StrictMode>,
));
