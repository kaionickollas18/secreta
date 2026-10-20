/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Schibsted Grotesk"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
          // Emojis coloridos do sistema (os mesmos do painel Win + . no Windows).
          '"Segoe UI Emoji"',
          '"Apple Color Emoji"',
          '"Noto Color Emoji"',
        ],
      },
      // Menor texto permitido (11px): selos, contadores e rótulos da barra. Nada abaixo disso.
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      colors: {
        canvas: "#0F0B1E",
        surface: "#1A1530",
        raised: "#2A2150",
        ink: "#FFFFFF",
        muted: "#A8A3C7",
        line: "rgba(167, 139, 250, 0.16)",
        accent: {
          DEFAULT: "#8B5CF6",
          soft: "rgba(139, 92, 246, 0.18)",
          strong: "#7C3AED",
          light: "#C4B5FD",
        },
        magenta: "#E879F9",
        // Amarelo "Lápis" da marca: o ponto do logotipo.
        pencil: "#F5B82E",
        "prio-low": { DEFAULT: "#4ADE80", tint: "rgba(34, 197, 94, 0.16)" },
        "prio-medium": { DEFAULT: "#FBBF24", tint: "rgba(251, 191, 36, 0.16)" },
        "prio-high": { DEFAULT: "#FB923C", tint: "rgba(251, 146, 60, 0.16)" },
        "prio-urgent": { DEFAULT: "#FB7185", tint: "rgba(244, 63, 94, 0.18)" },
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(139, 92, 246, 0.55)",
        card: "0 8px 24px -12px rgba(0, 0, 0, 0.6)",
      },
      // Movimento: sempre para dar retorno ou explicar uma mudança de estado.
      // Curva de chegada (desacelera no fim), sem "quique". Ver docs/ux-guidelines.md.
      keyframes: {
        "overlay-in": { from: { opacity: "0" } },
        // Janela no computador: surge do centro.
        "dialog-in": { from: { opacity: "0", transform: "translateY(12px) scale(0.98)" } },
        // Janela no celular: sobe como gaveta.
        "sheet-in": { from: { transform: "translateY(100%)" } },
        "toast-in": { from: { opacity: "0", transform: "translateY(10px)" } },
        // Item novo em uma lista (cartão, mensagem, resumo).
        enter: { from: { opacity: "0", transform: "translateY(6px)" } },
        // "O cartão pousa": contorno que acende e se apaga onde a tarefa chegou.
        arrive: {
          from: { boxShadow: "0 0 0 2px #C4B5FD, 0 0 28px 2px rgba(139, 92, 246, 0.55)" },
          to: { boxShadow: "0 0 0 2px rgba(196, 181, 253, 0), 0 0 28px 2px rgba(139, 92, 246, 0)" },
        },
        // Contador que mudou.
        pop: { from: { transform: "scale(1.45)" } },
        // Barra de frequência que cresce até o valor.
        bar: { from: { transform: "scaleX(0)" } },
        // Chama atenção e descansa (nunca em laço infinito).
        attention: { "50%": { opacity: "0.25" } },
      },
      animation: {
        "overlay-in": "overlay-in 200ms ease-out",
        "dialog-in": "dialog-in 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        "sheet-in": "sheet-in 360ms cubic-bezier(0.16, 1, 0.3, 1)",
        "toast-in": "toast-in 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        enter: "enter 280ms cubic-bezier(0.16, 1, 0.3, 1)",
        arrive: "arrive 1100ms ease-out",
        pop: "pop 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        bar: "bar 640ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        attention: "attention 900ms ease-in-out 3",
      },
    },
  },
  plugins: [],
};
