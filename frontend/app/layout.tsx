import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { EnvProvider } from "@/lib/env-context";
import { EnvSelector } from "@/components/EnvSelector";
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
        <EnvProvider>
          <div className="min-h-screen bg-background">
            <header className="border-b">
              <div className="container mx-auto px-6 py-4 flex items-center gap-6">
                <Link href="/" className="flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                    E
                  </div>
                  <span className="font-semibold text-lg">Ella Comms</span>
                </Link>
                <nav className="flex items-center gap-1">
                  <Link href="/" className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    Rules
                  </Link>
                  <Link href="/logs" className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    History
                  </Link>
                </nav>
                <div className="ml-auto">
                  <EnvSelector />
                </div>
              </div>
            </header>
            <main className="container mx-auto px-6 py-8">{children}</main>
          </div>
        </EnvProvider>
      </body>
    </html>
  );
}
