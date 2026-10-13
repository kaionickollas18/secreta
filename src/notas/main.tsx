import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { AuthGate } from "../components/auth/AuthGate";
import { AppShell } from "../components/layout/AppShell";
import "../index.css";
import { SCHOOL_ROLES } from "../utils/roles";
import NotasApp from "./NotasApp";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado.");

// Desenha já no primeiro quadro: a transição entre páginas fotografa a tela nesse instante.
const app = createRoot(root);
flushSync(() => app.render(
  <StrictMode>
    <AuthGate allow={SCHOOL_ROLES} redirects={{ master: "gestao.html" }}>
      <AppShell active="notas">
        <NotasApp />
      </AppShell>
    </AuthGate>
  </StrictMode>,
));
