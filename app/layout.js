import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

export const metadata = {
  title: 'WhatsApp Commerce Hub',
  description: 'Connect Shopify to WhatsApp Business for seamless product catalogs and payments',
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
        </ThemeProvider>
      </body>
    </html>
  )
}
