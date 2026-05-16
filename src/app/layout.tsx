import type { Metadata } from "next";
import { Geist_Mono, Newsreader, Syne } from "next/font/google";
import "./globals.css";

const forgeDisplay = Syne({
  subsets: ["latin"],
  variable: "--font-forge-display",
});

const forgeBody = Newsreader({
  subsets: ["latin"],
  variable: "--font-forge-body",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FORGE — Search before generate",
  description: "AI web app builder that searches current docs before writing code",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${forgeDisplay.variable} ${forgeBody.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-[var(--forge-bg)]">{children}</body>
    </html>
  );
}
