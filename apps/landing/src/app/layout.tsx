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
  title: "Lyse – The #1 AI assistant for tasks",
  description:
    "The PM your team never hired. Lyse handles spec writing, backlog prioritization, and decision logging so your engineering team can focus on building.",
  openGraph: {
    title: "Lyse – The #1 AI assistant for tasks",
    description:
      "The PM your team never hired. Everything a PM does. Nothing a PM costs.",
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
      className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} ${fragmentMono.variable} dark`}
    >
      <body className="min-h-screen bg-[#0a0908] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
