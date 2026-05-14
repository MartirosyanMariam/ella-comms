import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ella Comms Engine",
  description: "Internal notification rule management for Ella",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <header className="border-b">
            <div className="container mx-auto px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                E
              </div>
              <span className="font-semibold text-lg">Ella Comms Engine</span>
            </div>
          </header>
          <main className="container mx-auto px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
