import type { Metadata } from "next";
import { Inter, Fragment_Mono } from "next/font/google";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fragmentMono = Fragment_Mono({
  variable: "--font-fragment-mono",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  icons: {
    icon: "/logo-revi.svg",
    shortcut: "/logo-revi.svg",
    apple: "/logo-revi.svg",
  },
  title: "Revi – Reviews like you",
  description:
    "Revi watches how you review. Then reviews like you. Even when you're not there.",
  openGraph: {
    title: "Revi – Reviews like you",
    description:
      "Revi watches how you review. Then reviews like you. Even when you're not there.",
    images: ["/seo/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} ${fragmentMono.variable}`}
    >
      <body className="min-h-screen bg-[#fafaf9] text-[#0a0908] antialiased">
        {children}
      </body>
    </html>
  );
}
