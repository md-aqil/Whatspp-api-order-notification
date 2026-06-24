import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SiteFooter() {
  return (
    <footer className="bg-[#050810] border-t border-white/5 text-slate-300 relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-[#5c8cff] to-transparent opacity-30"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        
        {/* Large CTA before actual footer links */}
        <div className="text-center max-w-3xl mx-auto mb-24 relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Ready to boost your revenue?
          </h2>
          <p className="text-lg text-slate-400 mb-8 font-light">
            Join thousands of modern e-commerce brands using Chatflow to recover carts and delight customers on WhatsApp.
          </p>
          <Link href="/login">
            <Button size="lg" className="h-14 px-8 text-base bg-white/10 text-white hover:bg-white/20 border border-white/20 rounded-full shadow-[0_0_40px_rgba(9,34,118,0.5)] transition-all hover:scale-105 backdrop-blur-sm">
              Start your 14-day free trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 border-t border-white/5 pt-16 relative z-10">
          
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="inline-block mb-6">
              <div className="h-10 w-auto md:h-12 flex items-center justify-center">
                <img src="/chatflow-logo.png" alt="Chatflow" className="h-full w-full object-contain" />
              </div>
            </Link>
            <p className="text-slate-400 max-w-sm font-light leading-relaxed">
              The ultimate WhatsApp commerce platform for Shopify brands. Automate, support, and sell natively on the world's most popular messaging app.
            </p>
          </div>

          <div>
            <h3 className="text-white font-medium mb-6 tracking-tight">Product</h3>
            <ul className="space-y-4">
              <li><Link href="#features" className="text-sm text-slate-400 hover:text-white transition-colors font-light">Features</Link></li>
              <li><Link href="#automations" className="text-sm text-slate-400 hover:text-white transition-colors font-light">Automations</Link></li>
              <li><Link href="#integrations" className="text-sm text-slate-400 hover:text-white transition-colors font-light">Integrations</Link></li>
              <li><Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors font-light">Sign in</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-medium mb-6 tracking-tight">Legal</h3>
            <ul className="space-y-4">
              <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors font-light">Privacy Policy</Link></li>
              <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors font-light">Terms of Service</Link></li>
              <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors font-light">Cookie Policy</Link></li>
            </ul>
          </div>

        </div>
        
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
          <p className="text-sm text-slate-500 font-light">
            &copy; {new Date().getFullYear()} Chatflow Inc. All rights reserved.
          </p>
          <div className="text-sm text-slate-500 font-light flex items-center gap-1">
            Designed with <span className="text-[#5c8cff]">♥</span> for e-commerce
          </div>
        </div>
      </div>
    </footer>
  )
}
