import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { UiLanguageProvider } from "@/components/i18n/UiLanguageProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Report-O-Matic",
  description: "School report workflow for teachers and school admins.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <UiLanguageProvider>{children}</UiLanguageProvider>
      </body>
    </html>
  );
}
