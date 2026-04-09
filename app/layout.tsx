import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sync",
  description: "Agenda personnel mobile-first, sombre et rapide."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
