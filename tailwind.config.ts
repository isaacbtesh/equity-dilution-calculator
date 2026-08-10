import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-monospace", "monospace"],
        body: ["var(--font-body)", "ui-monospace", "monospace"],
      },
      colors: {
        case: {
          DEFAULT: "#ded7c4",
          hi: "#efe9da",
          lo: "#b8b1a0",
          edge: "#8e8878",
        },
        ink: {
          DEFAULT: "#2c2b26",
          soft: "#6b6759",
        },
        lcd: {
          DEFAULT: "#a7b894",
          dim: "#93a481",
          ink: "#1b2415",
        },
        signal: {
          orange: "#f26a1b",
          red: "#b3321f",
          blue: "#2c5f8a",
          green: "#3d6b2f",
        },
      },
    },
  },
  plugins: [],
};
export default config;
