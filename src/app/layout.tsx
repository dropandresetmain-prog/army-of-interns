import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Army of Interns | Command Centre", description: "Live adaptive workforce command centre" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
