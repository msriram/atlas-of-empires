import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas of Empires",
  description: "Explore civilizations across 12,000 years on an interactive world map.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
