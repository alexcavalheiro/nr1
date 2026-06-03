import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Plataforma NR-1",
  description: "Saúde Organizacional e Conformidade NR-1",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
