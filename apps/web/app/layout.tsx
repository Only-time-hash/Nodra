import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nodra — Control the blast radius of autonomous AI",
  description:
    "Containment, provenance, and recovery infrastructure for autonomous AI agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
