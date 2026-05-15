import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'Chatflow',
  description: 'Connect Shopify to WhatsApp Business for seamless product catalogs and payments',
  icons: {
    icon: '/favicon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      style={{
        '--font-body': 'system-ui',
        '--font-display': 'system-ui'
      }}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
