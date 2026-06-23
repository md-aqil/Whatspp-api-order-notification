import SiteHeader from '@/components/landing/SiteHeader'
import HeroSection from '@/components/landing/HeroSection'
import FeaturesGrid from '@/components/landing/FeaturesGrid'
import AutomationsShowcase from '@/components/landing/AutomationsShowcase'
import TrustSection from '@/components/landing/TrustSection'
import SiteFooter from '@/components/landing/SiteFooter'

export const metadata = {
  title: 'Chatflow | WhatsApp Commerce Hub',
  description: 'Turn Shopify orders into WhatsApp sales. Automate notifications, recover carts, and manage customer support.',
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-slate-900 selection:bg-green-100 selection:text-green-900">
      <SiteHeader />
      
      <main className="flex-1">
        <HeroSection />
        <TrustSection />
        <FeaturesGrid />
        <AutomationsShowcase />
      </main>

      <SiteFooter />
    </div>
  )
}
