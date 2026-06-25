import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0D0B", // app background
        surface: "#141614", // card / panel surface
        line: "#232623", // hairline borders
        muted: "#8A8F89", // secondary text
        "ink-text": "#E6E8E4", // primary off-white text on ink
        "ink-text-soft": "#CFD2CC", // secondary off-white (explainer/banners)
        copper: {
          DEFAULT: "#C8873A",
          soft: "#D9A35E",
          dim: "#7A5526",
        },
        health: {
          green: "#5FA777",
          yellow: "#D9A35E",
          red: "#C8643A",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Cormorant Garamond", "serif"],
        body: ["var(--font-body)", "DM Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Space Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
