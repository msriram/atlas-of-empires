import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH || "";
export const metadata: Metadata = {
  title: "Atlas of Empires",
  description: "Explore civilizations across 12,000 years on an interactive world map.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const analyticsId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
      {analyticsId && <script defer src="https://cloud.umami.is/script.js" data-website-id={analyticsId} data-do-not-track="true" />}
    </html>
  );
}
