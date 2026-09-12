import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

// Roster direction: Instrument Sans for interface text, IBM Plex Mono for data,
// timestamps and event identifiers. Loaded through next/font so they are actually
// served - the previous Inter / JetBrains Mono stacks were declared throughout the
// CSS but never loaded anywhere, and silently fell back to system-ui and generic
// monospace on any machine without them installed, the venue projector included.
const sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Army of Interns | Workspace",
  description: "Live adaptive workforce workspace",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
