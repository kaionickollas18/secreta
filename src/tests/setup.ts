import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  // Testes marcados com o ambiente "node" (criptografia) não têm janela.
  if (typeof window === "undefined") return;
  cleanup();
  window.localStorage.clear();
});
