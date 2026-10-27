/**
 * Cores do tema (claro e escuro, no padrão da Apple): os valores ficam em variáveis CSS em
 * `src/index.css`, como canais RGB, para os modificadores de opacidade (`bg-raised/60`)
 * continuarem valendo nos dois temas.
 */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;
/** Cor com opacidade própria do tema (separadores e tons de fundo), ainda ajustável por `/NN`. */
const tinted = (name, alpha) => `rgb(var(--${name}) / calc(var(--${alpha}) * <alpha-value>))`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // `dark:` vale no tema escuro escolhido ou, sem escolha, quando o sistema está no escuro.
  darkMode: [
    "variant",
    [
      '&:is([data-theme="dark"] *)',
      '@media (prefers-color-scheme: dark) { &:not(:is([data-theme="light"] *)) }',
    ],
  ],
  theme: {
    extend: {
      fontFamily: {
        // Fonte do sistema: SF Pro no iPhone e no Mac; Segoe UI no Windows; Roboto no Android.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          '"Helvetica Neue"',
          "Roboto",
          "Arial",
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
        canvas: token("canvas"),
        surface: token("surface"),
        raised: token("raised"),
        ink: token("ink"),
        muted: token("muted"),
        line: tinted("line", "line-alpha"),
        accent: {
          DEFAULT: token("accent"),
          soft: tinted("accent", "soft-alpha"),
          // Fundo de botão e item ativo com texto branco (contraste 4,5:1 nos dois temas).
          strong: token("accent-strong"),
          // Azul de texto e ícone sobre o fundo do tema.
          light: token("accent-light"),
        },
        magenta: token("magenta"),
        // Amarelo "Lápis" da marca: o ponto do logotipo.
        pencil: "#F5B82E",
        "prio-low": { DEFAULT: token("prio-low"), tint: tinted("prio-low", "tint-alpha") },
        "prio-medium": { DEFAULT: token("prio-medium"), tint: tinted("prio-medium", "tint-alpha") },
        "prio-high": { DEFAULT: token("prio-high"), tint: tinted("prio-high", "tint-alpha") },
        "prio-urgent": { DEFAULT: token("prio-urgent"), tint: tinted("prio-urgent", "tint-alpha") },
      },
      boxShadow: {
        glow: "var(--shadow-raised)",
        card: "var(--shadow-card)",
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
          from: { boxShadow: "0 0 0 2px rgb(var(--accent)), 0 0 24px 2px rgb(var(--accent) / 0.35)" },
          to: { boxShadow: "0 0 0 2px rgb(var(--accent) / 0), 0 0 24px 2px rgb(var(--accent) / 0)" },
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
