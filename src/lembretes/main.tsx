import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthGate } from "../components/auth/AuthGate";
import { AppShell } from "../components/layout/AppShell";
import "../index.css";
import { SCHOOL_ROLES } from "../utils/roles";
import LembretesApp from "./LembretesApp";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado.");

createRoot(root).render(
  <StrictMode>
    <AuthGate allow={SCHOOL_ROLES} redirects={{ master: "gestao.html" }}>
      <AppShell active="lembretes">
        <LembretesApp />
      </AppShell>
    </AuthGate>
  </StrictMode>,
);
