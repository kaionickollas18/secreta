import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { AuthGate } from "../components/auth/AuthGate";
import { AppShell } from "../components/layout/AppShell";
import "../index.css";
import { STAFF_ROLES, TEACHER_HOME } from "../utils/roles";
import LembretesApp from "./LembretesApp";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado.");

// Desenha já no primeiro quadro: a transição entre páginas fotografa a tela nesse instante.
const app = createRoot(root);
flushSync(() => app.render(
  <StrictMode>
    <AuthGate allow={STAFF_ROLES} redirects={{ master: "gestao.html", teacher: TEACHER_HOME }}>
      <AppShell active="lembretes">
        <LembretesApp />
      </AppShell>
    </AuthGate>
  </StrictMode>,
));
