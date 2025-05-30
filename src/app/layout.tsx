// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/layout/Navbar"; // Import the Navbar

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "LearnBridgEdu CogniSpark AI",
  description: "The future of personalized learning.",
  // Add icons here if you have them, e.g., for browser tab
  // icons: {
  //   icon: "/favicon.ico", // In public folder
  //   apple: "/apple-touch-icon.png", // In public folder
  // },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased flex flex-col", // Added flex flex-col
          inter.variable
        )}
      >
        <Navbar /> {/* Add Navbar at the top */}
        <main className="flex-grow flex flex-col container mx-auto px-4 py-6">
          {" "}
          {/* Ensure main content can grow and has padding */}
          {children}
        </main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
