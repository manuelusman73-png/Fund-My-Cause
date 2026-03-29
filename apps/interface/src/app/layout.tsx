import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/context/ThemeContext";
import { PageTransition } from "@/components/layout/PageTransition";

export const metadata: Metadata = {
  title: "Fund-My-Cause",
  description: "Decentralized crowdfunding on the Stellar network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <ThemeProvider>
          <ToastProvider>
            <WalletProvider>
              <PageTransition>{children}</PageTransition>
            </WalletProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
