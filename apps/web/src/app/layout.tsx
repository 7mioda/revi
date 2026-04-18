import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <ClerkProvider
          signInUrl="/sign-in"
          signInFallbackRedirectUrl="/"
          signUpUrl="/sign-in"
          appearance={{
            cssLayerName: 'clerk',
            variables: {
              fontFamily: 'var(--font-inter), sans-serif',
              colorPrimary: '#000000',
              colorText: '#111827',
              colorTextSecondary: '#6b7280',
              colorBackground: '#ffffff',
              colorInputBackground: '#f9fafb',
              colorInputText: '#111827',
              borderRadius: '0px',
              spacingUnit: '16px',
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
