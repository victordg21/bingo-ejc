import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bingo EJC",
  description: "Live church bingo controller — 1000 cards, 90 numbers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
