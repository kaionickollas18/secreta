import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { AuthGate } from "../components/auth/AuthGate";
import { AppShell } from "../components/layout/AppShell";
import "../index.css";
import { USER_ROLES } from "../types/auth";
import PerfilApp from "./PerfilApp";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado.");

// Desenha já no primeiro quadro: a transição entre páginas fotografa a tela nesse instante.
const app = createRoot(root);
flushSync(() => app.render(
  <StrictMode>
    <AuthGate allow={USER_ROLES}>
      <AppShell active="perfil">
        <PerfilApp />
      </AppShell>
    </AuthGate>
  </StrictMode>,
));
