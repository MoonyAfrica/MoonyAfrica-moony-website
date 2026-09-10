import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOONY Africa — Pour la santé des femmes, à chaque étape de leur vie",
  description:
    "MOONY Africa accompagne la santé des femmes avec une approche humaine, scientifique, accessible et ancrée dans les réalités du continent africain.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
