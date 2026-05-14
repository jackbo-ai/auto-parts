import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoParts — Back-office fournisseur de pièces",
  description:
    "Back-office fournisseur de pièces automobiles : catalogue, stock, fournisseurs, clients, commandes d'achat et de vente.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
