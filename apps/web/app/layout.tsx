import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Shipshape", template: "%s · Shipshape" },
  description:
    "Kanban boards and readiness rubrics across a portfolio of projects. Define the standard once, apply it everywhere, and see which projects do not match.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
