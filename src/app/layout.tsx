import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./prologue-refinement.css";

export const metadata: Metadata = {
  title: "Prologue Portfolio Intelligence",
  description: "Executive project financial performance, forecasting, and project-health reporting for Prologue Systems.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
