import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eliete Agenda Semestral",
  description: "Agenda virtual de julho a dezembro de 2026.",
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
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
