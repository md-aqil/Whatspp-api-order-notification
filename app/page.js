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
    <div className="min-h-screen flex flex-col font-sans bg-[#0a0d14] text-slate-100 selection:bg-[#092276]/40 selection:text-white">
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
