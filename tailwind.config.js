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
        ],
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
        "prio-low": { DEFAULT: "#4ADE80", tint: "rgba(34, 197, 94, 0.16)" },
        "prio-medium": { DEFAULT: "#FBBF24", tint: "rgba(251, 191, 36, 0.16)" },
        "prio-high": { DEFAULT: "#FB923C", tint: "rgba(251, 146, 60, 0.16)" },
        "prio-urgent": { DEFAULT: "#FB7185", tint: "rgba(244, 63, 94, 0.18)" },
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(139, 92, 246, 0.55)",
        card: "0 8px 24px -12px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};
