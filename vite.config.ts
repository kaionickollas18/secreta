import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: o GitHub Pages serve o site em /NOME-DO-REPO/, não na raiz.
  base: "./",
  build: {
    // Uma página por área: quadro (index.html), lembretes, mensagens, dashboard e gestão.
    rollupOptions: {
      input: {
        main: "index.html",
        lembretes: "lembretes.html",
        mensagens: "mensagens.html",
        frequencia: "frequencia.html",
        gestao: "gestao.html",
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    css: false,
  },
});
