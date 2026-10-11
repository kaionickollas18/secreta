import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Marca o script de entrada como bloqueante de renderização no build. Assim o navegador só
 * mostra a página nova quando o app já desenhou a tela, e a transição entre páginas
 * (view transitions) tem o que animar. Navegadores sem suporte ignoram o atributo.
 */
function renderBlockingEntry(): Plugin {
  return {
    name: "render-blocking-entry",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html) =>
        html.replace(/<script type="module" crossorigin src=/g, '<script type="module" blocking="render" crossorigin src='),
    },
  };
}

export default defineConfig({
  plugins: [react(), renderBlockingEntry()],
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
        perfil: "perfil.html",
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
