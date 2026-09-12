import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aoi: {
          bg: "var(--aoi-bg)", surf: "var(--aoi-surf)", surfR: "var(--aoi-surf-r)",
          bdr: "var(--aoi-bdr)", text: "var(--aoi-text)", t2: "var(--aoi-t2)", tm: "var(--aoi-tm)",
          accent: "var(--aoi-accent)", accentS: "var(--aoi-accent-s)",
          // Deprecated aliases of `accent`, kept so the migration can land
          // incrementally. Remove once no component references olive/gold.
          olive: "var(--aoi-accent)", gold: "var(--aoi-accent)", goldB: "var(--aoi-accent)",
          thn: "var(--aoi-thn)", act: "var(--aoi-act)", wt: "var(--aoi-wt)",
          blk: "var(--aoi-blk)", cmp: "var(--aoi-cmp)", idl: "var(--aoi-idl)"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;
