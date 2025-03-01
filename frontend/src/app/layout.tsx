import 'ethers'
import '@coinbase/onchainkit/styles.css'
import './globals.css'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import Sidebar from '@/components/sidebar'
import type React from 'react'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Memeulacra',
  description: 'The Future of Memes, Now.',

}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-title" content="Memeulacra" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                // Get the current hostname
                const currentHost = window.location.hostname
                console.log('checking hostname....')

                // The target domain we want to ensure users are on
                const targetDomains = ['memeulacra.com', 'localhost']

                // Check if the current hostname is exactly our target domain
                if (!targetDomains.includes(currentHost)) {
                  // Preserve the current path and query parameters in the redirect
                  const currentPath = window.location.pathname
                  const currentSearch = window.location.search
                  const currentHash = window.location.hash

                  // Construct the new URL with the correct domain
                  const redirectURL = "https://" + targetDomains[0] + currentPath + currentSearch + currentHash

                  // Redirect the browser to the new URL
                  window.location.href = redirectURL
                }
              }
              if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && !crypto.randomUUID) {
                crypto.randomUUID = function() {
                  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
                    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                  );
                };
                console.log('Added crypto.randomUUID polyfill via head script');
              }
            `,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Providers>
            <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
            <Toaster />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
