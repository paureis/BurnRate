import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        body: ["var(--font-body)", "Aptos", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgb(255 90 61 / 0.22)",
      },
      borderRadius: {
        panel: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
