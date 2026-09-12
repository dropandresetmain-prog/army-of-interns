import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aoi: {
          bg: "var(--aoi-bg)", surf: "var(--aoi-surf)", surfR: "var(--aoi-surf-r)",
          bdr: "var(--aoi-bdr)", text: "var(--aoi-text)", t2: "var(--aoi-t2)", tm: "var(--aoi-tm)",
          olive: "var(--aoi-olive)", gold: "var(--aoi-gold)", goldB: "var(--aoi-gold-b)",
          thn: "var(--aoi-thn)", act: "var(--aoi-act)", wt: "var(--aoi-wt)",
          blk: "var(--aoi-blk)", cmp: "var(--aoi-cmp)"
        }
      },
      fontFamily: { sans: ["Inter", "system-ui"], mono: ["JetBrains Mono", "monospace"] }
    }
  },
  plugins: []
} satisfies Config;
